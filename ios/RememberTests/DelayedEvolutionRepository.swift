import Foundation
@testable import Remember

actor DelayedEvolutionRepository: ImprintRepository {
    private var evolutionLoad: CheckedContinuation<EvolutionOverview, Never>?
    private var loadStartWaiters: [CheckedContinuation<Void, Never>] = []

    func waitUntilEvolutionLoadStarts() async {
        guard evolutionLoad == nil else { return }
        await withCheckedContinuation { loadStartWaiters.append($0) }
    }

    func finishEvolutionLoad(with overview: EvolutionOverview) {
        guard let pendingLoad = evolutionLoad else {
            preconditionFailure("Wait for the overview request before completing it.")
        }
        evolutionLoad = nil
        pendingLoad.resume(returning: overview)
    }

    func loadEvolution() async throws -> EvolutionOverview {
        await withCheckedContinuation { continuation in
            precondition(evolutionLoad == nil, "Complete the pending overview request first.")
            evolutionLoad = continuation
            let waiters = loadStartWaiters
            loadStartWaiters = []
            for waiter in waiters { waiter.resume() }
        }
    }

    func reflectOnMemory(itemID: UUID, response: MemoryReflection) async throws {}
    func rateContextualReturn(itemID: UUID, response: ContextualReturnFeedbackResponse) async throws {}
    func loadResurfacedItemID() async throws -> UUID? { nil }

    func hasSession() async -> Bool { true }
    func logout() async {}
    func resetAskConversation() async {}
    func login(email: String, password: String) async throws { throw URLError(.unsupportedURL) }
    func load() async throws -> [Imprint] { throw URLError(.unsupportedURL) }
    func loadDetail(_ imprint: Imprint) async throws -> Imprint { throw URLError(.unsupportedURL) }
    func capture(_ url: URL, personalReaction: String?, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        throw URLError(.unsupportedURL)
    }
    func captureThought(_ thought: String, returnCue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        throw URLError(.unsupportedURL)
    }
    func updateReturnCue(_ imprint: Imprint, cue: ReturnCue?, returnAt: Date?) async throws -> Imprint {
        throw URLError(.unsupportedURL)
    }
    func retry(_ imprint: Imprint) async throws -> Imprint { throw URLError(.unsupportedURL) }
    func updatePrinciple(id: UUID, status: String) async throws { throw URLError(.unsupportedURL) }
    func ask(_ question: String) async throws -> AskAnswer { throw URLError(.unsupportedURL) }
    func thinkThroughDecision(_ decision: String, context: String) async throws -> DecisionBrief {
        throw URLError(.unsupportedURL)
    }
}
