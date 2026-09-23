import Foundation
import Testing
@testable import Remember

@MainActor
struct EvolutionRefreshTests {
    @Test func anOlderSuccessfulOverviewCannotEraseAConfirmedRelease() async throws {
        let repository = DelayedEvolutionRepository()
        let store = makeStore(repository: repository)
        var imprint = try #require(FixtureLibrary.imprints.first)
        imprint.returnCue = .stuck
        store.imprints = [imprint]

        let refresh = Task { await store.loadDerivedData() }
        await repository.waitUntilEvolutionLoadStarts()
        #expect(await store.reflectOnMemory(imprint, response: .noLongerRelevant))
        await repository.finishEvolutionLoad(with: .empty)
        await refresh.value

        #expect(!store.evolutionLoadFailed)
        #expect(!store.isLoadingEvolution)
        #expect(store.evolutionOverview.reflections.map(\.response) == ["no_longer_relevant"])
        #expect(ReturnCueFinder.find(
            in: store.imprints,
            cue: .stuck,
            reflections: store.evolutionOverview.reflections
        ) == nil)
    }

    @Test func anOlderSuccessfulOverviewCannotEraseConfirmedNotTodayFeedback() async throws {
        let repository = DelayedEvolutionRepository()
        let store = makeStore(repository: repository)
        var imprint = try #require(FixtureLibrary.imprints.first)
        imprint.returnCue = .focus
        store.imprints = [imprint]

        let refresh = Task { await store.loadDerivedData() }
        await repository.waitUntilEvolutionLoadStarts()
        #expect(await store.rateContextualReturn(imprint, response: .notToday))
        await repository.finishEvolutionLoad(with: .empty)
        await refresh.value

        #expect(!store.evolutionLoadFailed)
        #expect(store.evolutionOverview.returnFeedback.map(\.response) == ["not_today"])
        #expect(ReturnCueFinder.find(
            in: store.imprints,
            cue: .focus,
            returnFeedback: store.evolutionOverview.returnFeedback
        ) == nil)
    }

    @Test func aFreshOverviewReplacesPreviousHistoryWhenNoResponseIsPending() async throws {
        let repository = DelayedEvolutionRepository()
        let store = makeStore(repository: repository)
        var imprint = try #require(FixtureLibrary.imprints.first)
        imprint.returnCue = .stuck
        store.imprints = [imprint]
        #expect(await store.reflectOnMemory(imprint, response: .noLongerRelevant))
        #expect(await store.rateContextualReturn(imprint, response: .notToday))
        let confirmedAt = Date.now.formatted(.iso8601)
        var freshOverview = EvolutionOverview.empty
        freshOverview.reflections = [EvolutionReflection(
            id: UUID().uuidString,
            itemId: imprint.id.uuidString,
            response: "still_true",
            occurredAt: confirmedAt
        )]
        freshOverview.returnFeedback = [EvolutionReturnFeedback(
            id: UUID().uuidString,
            itemId: imprint.id.uuidString,
            response: "useful",
            occurredAt: confirmedAt
        )]

        let refresh = Task { await store.loadDerivedData() }
        await repository.waitUntilEvolutionLoadStarts()
        await repository.finishEvolutionLoad(with: freshOverview)
        await refresh.value

        #expect(!store.evolutionLoadFailed)
        #expect(store.evolutionOverview.reflections == freshOverview.reflections)
        #expect(store.evolutionOverview.returnFeedback == freshOverview.returnFeedback)
        #expect(ReturnCueFinder.find(
            in: store.imprints,
            cue: .stuck,
            reflections: store.evolutionOverview.reflections,
            returnFeedback: store.evolutionOverview.returnFeedback
        )?.id == imprint.id)
    }

    @Test func anOverviewCompletedAfterSignOutCannotRestoreThePreviousAccountsHistory() async throws {
        let repository = DelayedEvolutionRepository()
        let store = makeStore(repository: repository)
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.isAuthenticated = true
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id
        var delayedOverview = EvolutionOverview.empty
        delayedOverview.reflections = [EvolutionReflection(
            id: UUID().uuidString,
            itemId: imprint.id.uuidString,
            response: "no_longer_relevant",
            occurredAt: Date.now.formatted(.iso8601)
        )]

        let refresh = Task { await store.loadDerivedData() }
        await repository.waitUntilEvolutionLoadStarts()
        await store.signOut()
        await repository.finishEvolutionLoad(with: delayedOverview)
        await refresh.value

        #expect(!store.isAuthenticated)
        #expect(store.imprints.isEmpty)
        #expect(store.evolutionOverview.isEmpty)
        #expect(store.resurfacedItemID == nil)
        #expect(store.resurfaced == nil)
    }

    private func makeStore(repository: any ImprintRepository) -> AppStore {
        AppStore(repository: repository, lifeRepository: TestLifeOSRepository(shouldFail: false))
    }
}
