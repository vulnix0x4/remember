import Foundation

actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let credentials: APICredentials
    private let youtubeTranscript: @Sendable (URL) async -> String?
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(
        baseURL: URL,
        session: URLSession = .shared,
        credentials: APICredentials = APICredentials(bearerToken: nil),
        youtubeTranscript: (@Sendable (URL) async -> String?)? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.credentials = credentials
        self.youtubeTranscript = youtubeTranscript ?? { url in
            await YouTubeTranscriptClient(session: session).transcript(for: url)
        }
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    func hasSession() async -> Bool {
        do {
            let _: APISessionResponse = try await request(path: "api/session", method: "GET", body: Optional<Data>.none)
            return true
        } catch {
            return false
        }
    }

    func login(email: String, password: String) async throws {
        let body = try encoder.encode(APIAuthRequest(email: email, password: password))
        let _: APISessionResponse = try await request(path: "api/auth/login", method: "POST", body: body)
    }

    func logout() async {
        var request = URLRequest(url: baseURL.appending(path: "api/auth/logout"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        _ = try? await session.data(for: request)
        if let host = baseURL.host() {
            HTTPCookieStorage.shared.cookies?.filter { $0.domain.contains(host) }.forEach(HTTPCookieStorage.shared.deleteCookie)
        }
    }

    func fetchImprints() async throws -> [Imprint] {
        let response: APIItemListResponse = try await request(path: "api/items", method: "GET", body: Optional<Data>.none)
        return try response.items.map(APIItemMapper.imprint)
    }

    func fetchEvolution() async throws -> EvolutionOverview {
        try await request(path: "api/evolution", method: "GET", body: Optional<Data>.none)
    }

    func fetchResurfacedItemID() async throws -> UUID? {
        let response: APIResurfacingResponse = try await request(
            path: "api/resurfacing/today",
            method: "GET",
            body: Optional<Data>.none
        )
        guard let value = response.memory?.itemId else { return nil }
        guard let id = UUID(uuidString: value) else { throw APIError.invalidResponse }
        return id
    }

    func capture(url: URL) async throws -> Imprint {
        struct Body: Encodable { let url: String; let sourceText: String? }
        let sourceText = await youtubeTranscript(url)
        let body = try encoder.encode(Body(url: url.absoluteString, sourceText: sourceText))
        let response: APICaptureResponse = try await request(path: "api/items", method: "POST", body: body, idempotencyKey: UUID().uuidString)
        return try APIItemMapper.imprint(from: response.item)
    }

    func retry(itemID: UUID, sourceURL: URL) async throws -> Imprint {
        struct Body: Encodable { let sourceText: String? }
        let sourceText = await youtubeTranscript(sourceURL)
        let body = try encoder.encode(Body(sourceText: sourceText))
        let response: APIRetryResponse = try await request(
            path: "api/items/\(itemID.uuidString.lowercased())/retry",
            method: "POST",
            body: body
        )
        return try APIItemMapper.imprint(from: response.item)
    }

    func ask(_ question: String) async throws -> AskAnswer {
        struct Body: Encodable { let question: String }
        let body = try encoder.encode(Body(question: question))
        let response: APIAskResponse = try await request(path: "api/ask", method: "POST", body: body)
        let citations = try response.citations.map { citation in
            guard let itemID = UUID(uuidString: citation.itemId), let url = URLValidator.validatedWebURL(from: citation.url) else {
                throw APIError.invalidResponse
            }
            return Citation(id: UUID(), itemID: itemID, title: citation.title, seconds: citation.timestampSeconds, url: url, excerpt: citation.excerpt)
        }
        return AskAnswer(text: response.answer, citations: citations, grounded: response.grounded, limitations: response.limitations)
    }

    private func request<Response: Decodable>(path: String, method: String, body: Data?, idempotencyKey: String? = nil) async throws -> Response {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in credentials.headers(for: baseURL) { request.setValue(value, forHTTPHeaderField: name) }
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else { throw APIError.server(httpResponse.statusCode) }
        return try decoder.decode(Response.self, from: data)
    }
}
