import Foundation

actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let credentials: APICredentials
    private let youtubeTranscript: @Sendable (URL) async -> String?
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var askThreadID: String?

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
        askThreadID = nil
        var request = URLRequest(url: baseURL.appending(path: "api/auth/logout"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        _ = try? await session.data(for: request)
        HTTPCookieStorage.shared.cookies(for: baseURL)?
            .filter { $0.name == "remember_session" }
            .forEach(HTTPCookieStorage.shared.deleteCookie)
    }

    func fetchImprints() async throws -> [Imprint] {
        var cursor: String?
        var seenCursors = Set<String>()
        var items: [Imprint] = []
        repeat {
            var components = URLComponents(url: baseURL.appending(path: "api/items"), resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "limit", value: "100")]
            if let cursor { components?.queryItems?.append(URLQueryItem(name: "cursor", value: cursor)) }
            guard let url = components?.url else { throw APIError.invalidResponse }
            let response: APIItemListResponse = try await request(url: url, method: "GET", body: Optional<Data>.none)
            items.append(contentsOf: try response.items.map { try APIItemMapper.imprint(from: $0) })
            if let next = response.nextCursor {
                guard seenCursors.insert(next).inserted else { throw APIError.invalidResponse }
            }
            cursor = response.nextCursor
        } while cursor != nil
        return items
    }

    func fetchImprint(id: UUID) async throws -> Imprint {
        let response: APIItemDetailResponse = try await request(
            path: "api/items/\(id.uuidString.lowercased())",
            method: "GET",
            body: Optional<Data>.none
        )
        return try APIItemMapper.imprint(
            from: response.item,
            connections: response.connections,
            principle: response.principles.first(where: { $0.status != "retired" })
        )
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

    func updatePrinciple(id: UUID, status: String) async throws {
        struct Body: Encodable { let status: String }
        struct Response: Decodable { let updated: Bool }
        let body = try encoder.encode(Body(status: status))
        let _: Response = try await request(
            path: "api/principles/\(id.uuidString.lowercased())",
            method: "PATCH",
            body: body
        )
    }

    func ask(_ question: String) async throws -> AskAnswer {
        struct Body: Encodable { let question: String; let threadId: String? }
        let body = try encoder.encode(Body(question: question, threadId: askThreadID))
        let response: APIAskResponse = try await request(path: "api/ask", method: "POST", body: body)
        askThreadID = response.threadId
        let citations = try response.citations.map { citation in
            guard let itemID = UUID(uuidString: citation.itemId), let url = URLValidator.validatedWebURL(from: citation.url) else {
                throw APIError.invalidResponse
            }
            return Citation(id: UUID(), itemID: itemID, title: citation.title, seconds: citation.timestampSeconds, url: url, excerpt: citation.excerpt)
        }
        return AskAnswer(text: response.answer, citations: citations, grounded: response.grounded, limitations: response.limitations)
    }

    private func request<Response: Decodable>(path: String, method: String, body: Data?, idempotencyKey: String? = nil) async throws -> Response {
        try await request(url: baseURL.appending(path: path), method: method, body: body, idempotencyKey: idempotencyKey)
    }

    private func request<Response: Decodable>(url: URL, method: String, body: Data?, idempotencyKey: String? = nil) async throws -> Response {
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
