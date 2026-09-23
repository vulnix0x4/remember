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
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value) { return date }
            if let date = try? Date.ISO8601FormatStyle().parse(value) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date: \(value)")
        }
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

    func decideNextMove(_ input: EverydayDecisionRequest) async throws -> EverydayDecision {
        try await request(path: "api/life/autopilot", method: "POST", body: encoder.encode(input))
    }

    func syncBrain(settings: BrainSettings? = nil) async throws -> BrainState? {
        let body = try settings.map { try encoder.encode($0) }
            ?? encoder.encode(["timeZone": TimeZone.current.identifier])
        let response: APIBrainResponse = try await request(
            path: settings == nil ? "api/life/brain/sync" : "api/life/brain",
            method: settings == nil ? "POST" : "PATCH", body: body
        )
        return response.brain
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

    func capture(url: URL, personalReaction: String? = nil, returnCue: ReturnCue? = nil, returnAt: Date? = nil) async throws -> Imprint {
        struct Body: Encodable {
            let url: String
            let personalReaction: String?
            let returnCue: String?
            let returnAt: Date?
            let sourceText: String?
        }
        let sourceText = await youtubeTranscript(url)
        let body = try encoder.encode(Body(
            url: url.absoluteString,
            personalReaction: personalReaction,
            returnCue: returnCue?.rawValue,
            returnAt: returnAt,
            sourceText: sourceText
        ))
        let response: APICaptureResponse = try await request(path: "api/items", method: "POST", body: body, idempotencyKey: UUID().uuidString)
        return try APIItemMapper.imprint(from: response.item)
    }

    func captureThought(_ thought: String, returnCue: ReturnCue? = nil, returnAt: Date? = nil) async throws -> Imprint {
        struct Body: Encodable {
            let thought: String
            let returnCue: String?
            let returnAt: Date?
        }
        let body = try encoder.encode(Body(
            thought: thought,
            returnCue: returnCue?.rawValue,
            returnAt: returnAt
        ))
        let response: APICaptureResponse = try await request(
            path: "api/items",
            method: "POST",
            body: body,
            idempotencyKey: UUID().uuidString
        )
        return try APIItemMapper.imprint(from: response.item)
    }

    func updateReturnCue(itemID: UUID, cue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        struct Body: Encodable { let returnCue: String?; let returnAt: Date? }
        struct Response: Decodable { let item: APIItemDTO }
        let body = try encoder.encode(Body(returnCue: cue?.rawValue, returnAt: returnAt))
        let response: Response = try await request(
            path: "api/items/\(itemID.uuidString.lowercased())/return-cue",
            method: "PATCH",
            body: body
        )
        return try APIItemMapper.imprint(from: response.item)
    }

    func retry(itemID: UUID, sourceURL: URL) async throws -> Imprint {
        struct Body: Encodable { let sourceText: String? }
        let sourceText = sourceURL.scheme == "remember" ? nil : await youtubeTranscript(sourceURL)
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

    func reflectOnMemory(itemID: UUID, response: MemoryReflection) async throws {
        struct Body: Encodable { let response: MemoryReflection }
        struct Response: Decodable { let recorded: Bool }
        let _: Response = try await request(
            path: "api/items/\(itemID.uuidString.lowercased())/reflect",
            method: "POST",
            body: try encoder.encode(Body(response: response))
        )
    }

    func rateContextualReturn(itemID: UUID, response: ContextualReturnFeedbackResponse) async throws {
        struct Body: Encodable { let response: ContextualReturnFeedbackResponse }
        struct Response: Decodable { let recorded: Bool }
        let _: Response = try await request(
            path: "api/items/\(itemID.uuidString.lowercased())/contextual-return-feedback",
            method: "POST",
            body: try encoder.encode(Body(response: response))
        )
    }

    func ask(_ question: String) async throws -> AskAnswer {
        struct Body: Encodable { let question: String; let threadId: String? }
        for attempt in 0...1 {
            let body = try encoder.encode(Body(question: question, threadId: askThreadID))
            do {
                let response: APIAskResponse = try await request(
                    path: "api/ask",
                    method: "POST",
                    body: body,
                    timeout: 50
                )
                askThreadID = response.threadId
                let citations = response.citations.compactMap { citation -> Citation? in
                    guard let itemID = UUID(uuidString: citation.itemId),
                          let url = Self.citationURL(from: citation.url) else { return nil }
                    return Citation(
                        id: UUID(),
                        itemID: itemID,
                        title: citation.title,
                        seconds: citation.timestampSeconds,
                        url: url,
                        excerpt: citation.excerpt
                    )
                }
                return AskAnswer(
                    text: response.answer,
                    citations: citations,
                    grounded: response.grounded && !citations.isEmpty,
                    limitations: response.limitations
                )
            } catch let error as APIError where attempt == 0 && error.code == "thread_not_found" {
                askThreadID = nil
            }
        }
        throw APIError.invalidResponse
    }

    func thinkThroughDecision(_ decision: String, context: String) async throws -> DecisionBrief {
        struct Body: Encodable { let decision: String; let context: String? }
        let response: APIDecisionResponse = try await request(
            path: "api/decisions",
            method: "POST",
            body: try encoder.encode(Body(decision: decision, context: context.isEmpty ? nil : context)),
            timeout: 50
        )
        let citations = response.citations.compactMap { citation -> Citation? in
            guard let itemID = UUID(uuidString: citation.itemId),
                  let url = Self.citationURL(from: citation.url) else { return nil }
            return Citation(
                id: UUID(),
                itemID: itemID,
                title: citation.title,
                seconds: citation.timestampSeconds,
                url: url,
                excerpt: citation.excerpt
            )
        }
        return DecisionBrief(
            decision: response.decision,
            perspective: response.perspective,
            whatMatters: response.whatMatters,
            pullToward: response.pullToward,
            pullAgainst: response.pullAgainst,
            smallTest: response.smallTest,
            nextQuestion: response.nextQuestion,
            citations: citations,
            grounded: response.grounded && !citations.isEmpty,
            limitations: response.limitations
        )
    }

    func resetAskConversation() {
        askThreadID = nil
    }

    private static func citationURL(from value: String) -> URL? {
        if let url = URL(string: value), url.scheme == "remember" { return url }
        return URLValidator.validatedWebURL(from: value)
    }

    func fetchLifeSnapshot() async throws -> LifeSnapshot {
        try await request(path: "api/life", method: "GET", body: Optional<Data>.none)
    }

    func createLifeTask(_ task: CreateLifeTaskRequest) async throws -> LifeTask {
        struct Response: Decodable { let task: LifeTask }
        let response: Response = try await request(path: "api/life/tasks", method: "POST", body: try encoder.encode(task))
        return response.task
    }

    func updateLifeTask(id: UUID, status: LifeTaskStatus) async throws -> LifeTask {
        struct Body: Encodable { let status: LifeTaskStatus }
        struct Response: Decodable { let task: LifeTask }
        let response: Response = try await request(
            path: "api/life/tasks/\(id.uuidString.lowercased())",
            method: "PATCH",
            body: try encoder.encode(Body(status: status))
        )
        return response.task
    }

    func completeLifeTask(id: UUID, minutesSpent: Int, result: PracticeResult?) async throws {
        struct Body: Encodable { let minutesSpent: Int; let result: PracticeResult? }
        struct Response: Decodable { let task: LifeTask; let next: LifeTask? }
        let _: Response = try await request(
            path: "api/life/tasks/\(id.uuidString.lowercased())/complete",
            method: "POST",
            body: try encoder.encode(Body(minutesSpent: max(0, minutesSpent), result: result))
        )
    }

    func reflectOnPractice(id: UUID, result: PracticeResult) async throws -> LifeTask {
        struct Response: Decodable { let task: LifeTask }
        let response: Response = try await request(
            path: "api/life/tasks/\(id.uuidString.lowercased())/reflect",
            method: "POST",
            body: try encoder.encode(result)
        )
        return response.task
    }

    func blockLifeTask(id: UUID, reason: LifeBlockerReason) async throws {
        struct Body: Encodable { let reason: LifeBlockerReason }
        struct Response: Decodable { let task: LifeTask; let next: LifeTask? }
        let _: Response = try await request(
            path: "api/life/tasks/\(id.uuidString.lowercased())/block",
            method: "POST",
            body: try encoder.encode(Body(reason: reason))
        )
    }

    func createLifeGoal(_ goal: CreateLifeGoalRequest) async throws -> LifeGoal {
        struct Response: Decodable { let goal: LifeGoal }
        let response: Response = try await request(path: "api/life/goals", method: "POST", body: try encoder.encode(goal))
        return response.goal
    }

    func createLifeFloorItem(_ item: CreateLifeFloorRequest) async throws -> LifeFloorItem {
        struct Response: Decodable { let item: LifeFloorItem }
        let response: Response = try await request(path: "api/life/floor", method: "POST", body: try encoder.encode(item))
        return response.item
    }

    func toggleLifeFloorItem(id: UUID, date: Date) async throws -> LifeFloorItem {
        struct Body: Encodable { let date: Date }
        struct Response: Decodable { let item: LifeFloorItem }
        let response: Response = try await request(
            path: "api/life/floor/\(id.uuidString.lowercased())/toggle",
            method: "POST",
            body: try encoder.encode(Body(date: date))
        )
        return response.item
    }

    func syncHealthMetrics(_ metrics: [HealthMetricUpload]) async throws {
        struct Body: Encodable { let metrics: [HealthMetricUpload] }
        struct Response: Decodable { let synced: Int }
        for start in stride(from: 0, to: metrics.count, by: 400) {
            let batch = Array(metrics[start..<min(start + 400, metrics.count)])
            let _: Response = try await request(path: "api/life/health/sync", method: "POST", body: try encoder.encode(Body(metrics: batch)), timeout: 45)
        }
    }

    func syncCalendarEvents(_ events: [CalendarEventUpload]) async throws {
        struct Body: Encodable { let events: [CalendarEventUpload] }
        struct Response: Decodable { let synced: Int }
        for start in stride(from: 0, to: events.count, by: 250) {
            let batch = Array(events[start..<min(start + 250, events.count)])
            let _: Response = try await request(path: "api/life/calendar/sync", method: "POST", body: try encoder.encode(Body(events: batch)), timeout: 45)
        }
    }

    func addFinanceAccount(_ account: FinanceAccountUpload) async throws -> LifeFinanceAccount {
        struct Body: Encodable { let accounts: [FinanceAccountUpload] }
        struct Response: Decodable { let accounts: [LifeFinanceAccount] }
        let response: Response = try await request(path: "api/life/finance/accounts/sync", method: "POST", body: try encoder.encode(Body(accounts: [account])))
        guard let account = response.accounts.first else { throw APIError.invalidResponse }
        return account
    }

    func addFinanceTransaction(_ transaction: FinanceTransactionUpload) async throws {
        struct Body: Encodable { let transactions: [FinanceTransactionUpload] }
        struct Response: Decodable { let synced: Int }
        let _: Response = try await request(path: "api/life/finance/transactions/sync", method: "POST", body: try encoder.encode(Body(transactions: [transaction])))
    }

    func uploadVaultFile(data: Data, name: String, mimeType: String) async throws -> LifeVaultFile {
        guard data.count <= 25 * 1_024 * 1_024 else { throw APIError.server(422) }
        struct Response: Decodable { let file: LifeVaultFile }
        let boundary = "Remember-\(UUID().uuidString)"
        let safeName = name.replacingOccurrences(of: "\"", with: "")
        var body = Data()
        body.appendUTF8("--\(boundary)\r\n")
        body.appendUTF8("Content-Disposition: form-data; name=\"file\"; filename=\"\(safeName)\"\r\n")
        body.appendUTF8("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        body.appendUTF8("\r\n--\(boundary)--\r\n")
        var upload = URLRequest(url: baseURL.appending(path: "api/life/files"))
        upload.httpMethod = "POST"
        upload.httpBody = body
        upload.timeoutInterval = 60
        upload.setValue("application/json", forHTTPHeaderField: "Accept")
        upload.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        for (name, value) in credentials.headers(for: baseURL) { upload.setValue(value, forHTTPHeaderField: name) }
        let (responseData, response) = try await session.data(for: upload)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.server(http.statusCode) }
        return try decoder.decode(Response.self, from: responseData).file
    }

    func downloadVaultFile(id: UUID) async throws -> Data {
        var download = URLRequest(
            url: baseURL.appending(path: "api/life/files/\(id.uuidString.lowercased())/download")
        )
        download.httpMethod = "GET"
        download.timeoutInterval = 60
        for (name, value) in credentials.headers(for: baseURL) {
            download.setValue(value, forHTTPHeaderField: name)
        }
        let (data, response) = try await session.data(for: download)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.server(http.statusCode) }
        return data
    }

    func deleteVaultFile(id: UUID) async throws {
        var deletion = URLRequest(
            url: baseURL.appending(path: "api/life/files/\(id.uuidString.lowercased())")
        )
        deletion.httpMethod = "DELETE"
        deletion.timeoutInterval = 30
        for (name, value) in credentials.headers(for: baseURL) {
            deletion.setValue(value, forHTTPHeaderField: name)
        }
        let (_, response) = try await session.data(for: deletion)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.server(http.statusCode) }
    }

    private func request<Response: Decodable>(
        path: String,
        method: String,
        body: Data?,
        idempotencyKey: String? = nil,
        timeout: TimeInterval = 15
    ) async throws -> Response {
        try await request(
            url: baseURL.appending(path: path),
            method: method,
            body: body,
            idempotencyKey: idempotencyKey,
            timeout: timeout
        )
    }

    private func request<Response: Decodable>(
        url: URL,
        method: String,
        body: Data?,
        idempotencyKey: String? = nil,
        timeout: TimeInterval = 15
    ) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in credentials.headers(for: baseURL) { request.setValue(value, forHTTPHeaderField: name) }
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else {
            if let payload = try? decoder.decode(APIErrorResponse.self, from: data) {
                throw APIError.response(
                    status: httpResponse.statusCode,
                    code: payload.error.code,
                    message: payload.error.message,
                    requestID: payload.requestId
                )
            }
            throw APIError.server(httpResponse.statusCode)
        }
        return try decoder.decode(Response.self, from: data)
    }
}

private extension Data {
    mutating func appendUTF8(_ value: String) { append(contentsOf: value.utf8) }
}
