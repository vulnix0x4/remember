import Foundation

protocol ImprintRepository: Sendable {
    func hasSession() async -> Bool
    func login(email: String, password: String) async throws
    func logout() async
    func load() async throws -> [Imprint]
    func loadEvolution() async throws -> EvolutionOverview
    func loadResurfacedItemID() async throws -> UUID?
    func capture(_ url: URL) async throws -> Imprint
    func retry(_ imprint: Imprint) async throws -> Imprint
    func ask(_ question: String) async throws -> AskAnswer
}

actor LiveImprintRepository: ImprintRepository {
    private let client: APIClient
    private let usesMockFallback: Bool

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
            return FixtureLibrary.imprints
        }
    }

    func loadEvolution() async throws -> EvolutionOverview {
        do {
            return try await client.fetchEvolution()
        } catch where usesMockFallback {
            return .empty
        }
    }

    func loadResurfacedItemID() async throws -> UUID? {
        do {
            return try await client.fetchResurfacedItemID()
        } catch where usesMockFallback {
            return nil
        }
    }

    func capture(_ url: URL) async throws -> Imprint {
        do {
            return try await client.capture(url: url)
        } catch where usesMockFallback {
            return Imprint(
                id: UUID(), url: url, thumbnailURL: nil, sourceType: Self.sourceType(for: url), title: url.host() ?? "Saved link", creator: "Processing source",
                savedAt: .now, lifePeriod: "Now", essence: "Remember is beginning to understand why this might matter.",
                summary: "Processing is underway.", keyIdeas: [], moments: [], themes: [], claims: [],
                candidatePrinciples: [], experiments: [], personalHypotheses: [], uncertainties: [],
                connections: [], state: .processing, reaction: nil
            )
        }
    }

    func retry(_ imprint: Imprint) async throws -> Imprint {
        do {
            return try await client.retry(itemID: imprint.id)
        } catch where usesMockFallback {
            return Imprint(
                id: imprint.id,
                url: imprint.url,
                thumbnailURL: imprint.thumbnailURL,
                sourceType: imprint.sourceType,
                title: imprint.title,
                creator: imprint.creator,
                savedAt: imprint.savedAt,
                lifePeriod: imprint.lifePeriod,
                essence: "Remember is trying again.",
                summary: "Understanding is underway.",
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
                reaction: imprint.reaction
            )
        }
    }

    func ask(_ question: String) async throws -> AskAnswer {
        do {
            return try await client.ask(question)
        } catch where usesMockFallback {
            return MockAnswerer.answer(question, imprints: FixtureLibrary.imprints)
        }
    }

    private static func sourceType(for url: URL) -> SourceType {
        let host = url.host()?.lowercased() ?? ""
        return host == "youtu.be" || host.hasSuffix("youtube.com") ? .youtube : .web
    }
}
