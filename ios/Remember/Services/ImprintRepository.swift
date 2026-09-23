import Foundation

protocol ImprintRepository: Sendable {
    func hasSession() async -> Bool
    func login(email: String, password: String) async throws
    func logout() async
    func load() async throws -> [Imprint]
    func loadDetail(_ imprint: Imprint) async throws -> Imprint
    func loadEvolution() async throws -> EvolutionOverview
    func loadResurfacedItemID() async throws -> UUID?
    func capture(_ url: URL, personalReaction: String?, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint
    func captureThought(_ thought: String, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint
    func updateReturnCue(_ imprint: Imprint, cue: ReturnCue?, returnAt: Date?) async throws -> Imprint
    func retry(_ imprint: Imprint) async throws -> Imprint
    func updatePrinciple(id: UUID, status: String) async throws
    func reflectOnMemory(itemID: UUID, response: MemoryReflection) async throws
    func rateContextualReturn(itemID: UUID, response: ContextualReturnFeedbackResponse) async throws
    func ask(_ question: String) async throws -> AskAnswer
    func thinkThroughDecision(_ decision: String, context: String) async throws -> DecisionBrief
    func resetAskConversation() async
}

actor LiveImprintRepository: ImprintRepository {
    private let client: APIClient
    private let usesMockFallback: Bool
    private var mockCaptured: [Imprint] = []

    init(client: APIClient, usesMockFallback: Bool = false) {
        self.client = client
        self.usesMockFallback = usesMockFallback
    }

    func hasSession() async -> Bool {
        if usesMockFallback { return true }
        return await client.hasSession()
    }

    func login(email: String, password: String) async throws {
        if usesMockFallback { return }
        try await client.login(email: email, password: password)
    }

    func logout() async {
        await client.logout()
    }

    func load() async throws -> [Imprint] {
        do {
            return try await client.fetchImprints()
        } catch where usesMockFallback {
            let capturedIDs = Set(mockCaptured.map(\.id))
            return mockCaptured + FixtureLibrary.imprints.filter { !capturedIDs.contains($0.id) }
        }
    }

    func loadDetail(_ imprint: Imprint) async throws -> Imprint {
        do {
            return try await client.fetchImprint(id: imprint.id)
        } catch where usesMockFallback {
            return imprint
        }
    }

    func loadEvolution() async throws -> EvolutionOverview {
        do {
            return try await client.fetchEvolution()
        } catch where usesMockFallback {
            return FixtureLibrary.evolutionOverview
        }
    }

    func loadResurfacedItemID() async throws -> UUID? {
        do {
            return try await client.fetchResurfacedItemID()
        } catch where usesMockFallback {
            return nil
        }
    }

    func capture(_ url: URL, personalReaction: String?, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        do {
            return try await client.capture(url: url, personalReaction: personalReaction, returnCue: returnCue, returnAt: returnAt)
        } catch where usesMockFallback {
            let imprint = Imprint(
                id: UUID(), url: url, thumbnailURL: nil, sourceType: Self.sourceType(for: url), title: url.host() ?? "Saved link", creator: "Processing source",
                savedAt: .now, lifePeriod: "Now", essence: "Saved and queued for analysis.",
                summary: "Analysis is underway.", keyIdeas: [], moments: [], themes: [], claims: [],
                candidatePrinciples: [], experiments: [], personalHypotheses: [], uncertainties: [],
                connections: [], state: .processing, reaction: personalReaction,
                returnCue: returnCue, returnAt: returnAt
            )
            rememberMock(imprint)
            return imprint
        }
    }

    func captureThought(_ thought: String, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        do {
            return try await client.captureThought(thought, returnCue: returnCue, returnAt: returnAt)
        } catch where usesMockFallback {
            let id = UUID()
            guard let url = URL(string: "remember://thought/\(id.uuidString.lowercased())") else {
                throw APIError.invalidResponse
            }
            let imprint = Imprint(
                id: id,
                url: url,
                thumbnailURL: nil,
                sourceType: .note,
                title: Self.thoughtTitle(from: thought),
                creator: "You",
                savedAt: .now,
                lifePeriod: "Now",
                essence: "Saved. Remember is finding what this connects to.",
                summary: "Your thought can now shape answers, patterns, and useful returns.",
                keyIdeas: [],
                moments: [],
                themes: [],
                claims: [],
                candidatePrinciples: [],
                experiments: [],
                personalHypotheses: [],
                uncertainties: [],
                connections: [],
                state: .processing,
                reaction: nil,
                analysisScope: nil,
                returnCue: returnCue,
                returnAt: returnAt,
                noteText: thought
            )
            rememberMock(imprint)
            return imprint
        }
    }

    func updateReturnCue(_ imprint: Imprint, cue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        do {
            return try await client.updateReturnCue(itemID: imprint.id, cue: cue, returnAt: returnAt)
        } catch where usesMockFallback {
            var updated = imprint
            updated.returnCue = cue
            updated.returnAt = returnAt
            rememberMock(updated)
            return updated
        }
    }

    func retry(_ imprint: Imprint) async throws -> Imprint {
        do {
            return try await client.retry(itemID: imprint.id, sourceURL: imprint.url)
        } catch where usesMockFallback {
            let updated = Imprint(
                id: imprint.id,
                url: imprint.url,
                thumbnailURL: imprint.thumbnailURL,
                sourceType: imprint.sourceType,
                title: imprint.title,
                creator: imprint.creator,
                savedAt: imprint.savedAt,
                lifePeriod: imprint.lifePeriod,
                essence: "Remember is trying the analysis again.",
                summary: "Analysis is underway.",
                keyIdeas: [],
                moments: [],
                themes: [],
                claims: [],
                candidatePrinciples: [],
                experiments: [],
                personalHypotheses: [],
                uncertainties: [],
                connections: imprint.connections,
                state: .processing,
                reaction: imprint.reaction,
                returnCue: imprint.returnCue,
                returnAt: imprint.returnAt
            )
            rememberMock(updated)
            return updated
        }
    }

    func updatePrinciple(id: UUID, status: String) async throws {
        if usesMockFallback { return }
        try await client.updatePrinciple(id: id, status: status)
    }

    func reflectOnMemory(itemID: UUID, response: MemoryReflection) async throws {
        if usesMockFallback { return }
        try await client.reflectOnMemory(itemID: itemID, response: response)
    }

    func rateContextualReturn(itemID: UUID, response: ContextualReturnFeedbackResponse) async throws {
        if usesMockFallback { return }
        try await client.rateContextualReturn(itemID: itemID, response: response)
    }

    func ask(_ question: String) async throws -> AskAnswer {
        do {
            return try await client.ask(question)
        } catch where usesMockFallback {
            return MockAnswerer.answer(question, imprints: FixtureLibrary.imprints)
        }
    }

    func thinkThroughDecision(_ decision: String, context: String) async throws -> DecisionBrief {
        do {
            return try await client.thinkThroughDecision(decision, context: context)
        } catch where usesMockFallback {
            return DecisionBriefBuilder.build(decision: decision, context: context, imprints: FixtureLibrary.imprints)
        }
    }

    func resetAskConversation() async {
        await client.resetAskConversation()
    }

    private static func sourceType(for url: URL) -> SourceType {
        let host = url.host()?.lowercased() ?? ""
        return host == "youtu.be" || host.hasSuffix("youtube.com") ? .youtube : .web
    }

    private static func thoughtTitle(from thought: String) -> String {
        let firstLine = thought.split(whereSeparator: \.isNewline).first.map(String.init) ?? thought
        let clean = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count > 88 else { return clean }
        let candidate = String(clean.prefix(85))
        let boundary = candidate.lastIndex(of: " ")
        return (boundary.map { String(candidate[..<$0]) } ?? candidate) + "…"
    }

    private func rememberMock(_ imprint: Imprint) {
        if let index = mockCaptured.firstIndex(where: { $0.id == imprint.id || $0.url == imprint.url }) {
            mockCaptured[index] = imprint
        } else {
            mockCaptured.insert(imprint, at: 0)
        }
    }
}
