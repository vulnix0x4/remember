import Foundation
import Testing
@testable import Remember

@MainActor
struct ResurfacedEligibilityTests {
    @Test func aConfirmedReleaseImmediatelySuppressesThePersistedFallback() async throws {
        let store = makeStore()
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id
        #expect(store.resurfaced?.id == imprint.id)

        #expect(await store.reflectOnMemory(imprint, response: .noLongerRelevant))

        #expect(store.resurfaced == nil)
        #expect(store.imprints.count == 1)
        #expect(store.evolutionOverview.reflections.first?.response == "no_longer_relevant")
    }

    @Test func notTodayCannotFallStraightThroughToTheSamePersistedReturn() async throws {
        let store = makeStore()
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id

        #expect(await store.rateContextualReturn(imprint, response: .notToday))
        #expect(store.resurfaced == nil)

        #expect(await store.rateContextualReturn(imprint, response: .useful))
        #expect(store.resurfaced?.id == imprint.id)
    }

    @Test func thePersistedFallbackCannotRepeatAFulfilledDatedReturn() throws {
        let store = makeStore()
        var imprint = try #require(FixtureLibrary.imprints.first)
        imprint.returnCue = .date
        imprint.returnAt = .now.addingTimeInterval(-86_400)
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id
        store.evolutionOverview.reflections = [EvolutionReflection(
            id: UUID().uuidString,
            itemId: imprint.id.uuidString,
            response: "still_true",
            occurredAt: Date.now.formatted(.iso8601)
        )]

        #expect(store.resurfaced == nil)
    }

    @Test func aRejectedExperimentAlsoSuppressesThePersistedFallback() throws {
        let store = makeStore()
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id
        var task = try #require(FixtureLibrary.lifeSnapshot.tasks.first)
        task.source = "practice"
        task.sourceItemId = imprint.id
        task.practiceOutcome = .notForMe
        store.lifeSnapshot.tasks = [task]

        #expect(store.resurfaced == nil)
    }

    @Test func aFailedOverviewRefreshPreservesKnownReturnFeedback() async throws {
        let store = makeStore(usesMockFallback: false)
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.evolutionOverview.reflections = [EvolutionReflection(
            id: UUID().uuidString,
            itemId: imprint.id.uuidString,
            response: "no_longer_relevant",
            occurredAt: Date.now.formatted(.iso8601)
        )]

        await store.loadDerivedData()

        #expect(store.evolutionLoadFailed)
        #expect(ReturnCueFinder.find(in: [imprint], cue: .stuck, reflections: store.evolutionOverview.reflections) == nil)
    }

    @Test func signingOutClearsRetainedReturnHistory() async throws {
        let store = makeStore()
        let imprint = try #require(FixtureLibrary.imprints.first)
        store.imprints = [imprint]
        store.resurfacedItemID = imprint.id
        store.evolutionOverview = FixtureLibrary.evolutionOverview
        store.lifeSnapshot = FixtureLibrary.lifeSnapshot
        store.lastAskedQuestion = EvolutionRecentQuestion(question: "What matters now?", askedAt: Date.now.formatted(.iso8601))

        await store.signOut()

        #expect(store.imprints.isEmpty)
        #expect(store.evolutionOverview.isEmpty)
        #expect(store.resurfacedItemID == nil)
        #expect(store.lifeSnapshot.tasks.isEmpty)
        #expect(store.lastAskedQuestion == nil)
    }

    private func makeStore(usesMockFallback: Bool = true) -> AppStore {
        let client = APIClient(baseURL: .temporaryDirectory, credentials: APICredentials(bearerToken: nil))
        return AppStore(
            repository: LiveImprintRepository(client: client, usesMockFallback: usesMockFallback),
            lifeRepository: TestLifeOSRepository(shouldFail: false)
        )
    }
}
