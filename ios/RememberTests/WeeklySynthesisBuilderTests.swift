import Foundation
import Testing
@testable import Remember

struct WeeklySynthesisBuilderTests {
    @Test func turnsRecentAttentionAndAResultIntoOneWeeklyStory() {
        let now = Date(timeIntervalSince1970: 1_788_268_800)
        let source = FixtureLibrary.imprints[2]
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [practice(sourceItemId: source.id, outcome: .helped, now: now)]

        let review = WeeklySynthesisBuilder.build(imprints: [recentCopy(of: source, now: now)], life: snapshot, now: now)

        #expect(review?.headline == "Something worked.")
        #expect(review?.theme == "Purpose")
        #expect(review?.outcome == .helped)
        #expect(review?.canCarryForward == true)
        #expect(review?.story.contains("attention kept returning") == true)
        #expect(review?.reflection == "Starting with my own work changed the whole day.")
    }

    @Test func doesNotOfferADuplicateCarryForward() {
        let now = Date(timeIntervalSince1970: 1_788_268_800)
        let source = FixtureLibrary.imprints[2]
        var next = practice(sourceItemId: source.id, outcome: nil, now: now)
        next.status = .queued
        next.completedAt = nil
        next.reflectedAt = nil
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [practice(sourceItemId: source.id, outcome: .helped, now: now), next]

        #expect(WeeklySynthesisBuilder.build(imprints: [], life: snapshot, now: now)?.canCarryForward == false)
    }

    @Test func keepsAnOlderExperimentDistinctFromAnUnrelatedRecentTheme() {
        let now = Date(timeIntervalSince1970: 1_788_268_800)
        let olderSource = FixtureLibrary.imprints[0]
        let recentSource = FixtureLibrary.imprints[2]
        var result = practice(sourceItemId: olderSource.id, outcome: .helped, now: now)
        result.title = "Name one useful change"
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [result]

        let review = WeeklySynthesisBuilder.build(
            imprints: [olderSource, recentCopy(of: recentSource, now: now)],
            life: snapshot,
            now: now
        )

        #expect(review?.story.contains("An older idea about rebuilding moved into real life") == true)
        #expect(review?.story.contains("Your newer saves kept circling purpose") == true)
        #expect(review?.story.contains("attention kept returning to purpose. In real life") == false)
    }

    @Test func staysOutOfTheWayWithoutRecentActivity() {
        #expect(WeeklySynthesisBuilder.build(imprints: [], life: .empty, now: .now) == nil)
    }

    private func practice(sourceItemId: UUID, outcome: PracticeOutcome?, now: Date) -> LifeTask {
        LifeTask(
            id: UUID(), goalId: nil, title: "Make before consuming", firstStep: "Create for fifteen minutes", notes: "", area: .work,
            status: .done, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "practice", sourceItemId: sourceItemId,
            practiceOutcome: outcome, practiceReflection: "Starting with my own work changed the whole day.", reflectedAt: now.addingTimeInterval(-86_400),
            completedAt: now.addingTimeInterval(-86_400), createdAt: now.addingTimeInterval(-172_800), updatedAt: now.addingTimeInterval(-86_400)
        )
    }

    private func recentCopy(of imprint: Imprint, now: Date) -> Imprint {
        Imprint(
            id: imprint.id, url: imprint.url, thumbnailURL: imprint.thumbnailURL, sourceType: imprint.sourceType,
            title: imprint.title, creator: imprint.creator, savedAt: now.addingTimeInterval(-86_400), lifePeriod: imprint.lifePeriod,
            essence: imprint.essence, summary: imprint.summary, keyIdeas: imprint.keyIdeas, moments: imprint.moments,
            themes: imprint.themes, claims: imprint.claims, candidatePrinciples: imprint.candidatePrinciples,
            experiments: imprint.experiments, personalHypotheses: imprint.personalHypotheses,
            uncertainties: imprint.uncertainties, connections: imprint.connections, state: imprint.state, reaction: imprint.reaction,
            principleID: imprint.principleID, principleStatus: imprint.principleStatus, analysisScope: imprint.analysisScope
        )
    }
}
