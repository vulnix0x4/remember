import Foundation
import Testing
@testable import Remember

struct ContextualReturnFinderTests {
    @Test func findsASavedIdeaThatCanHelpWithTheCurrentTask() {
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [activeTask(
            title: "Protect a focused block for creative work",
            firstStep: "Make before consuming",
            area: .direction
        )]

        let result = ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: snapshot)

        #expect(result?.imprint.title == "The first quiet hour is where I can hear myself think")
        #expect(result?.reason.contains("current task") == true)
        #expect(result?.reason.contains("Protect a focused block for creative work") == true)
        #expect(result?.contextArea == .work)
        #expect(result?.question == "What from “The first quiet hour is where I can hear myself think” could help me with “Protect a focused block for creative work” today?")
    }

    @Test func staysQuietWithoutACurrentDirection() {
        #expect(ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: .empty) == nil)
    }

    @Test func prioritizesAnIdeaThatHelpedInRealLife() {
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [
            activeTask(
                title: "Rebuild deliberately after a difficult season",
                firstStep: "Name what this season clarified",
                area: .growth
            ),
            resultTask(sourceItemId: FixtureLibrary.imprints[0].id, outcome: .helped)
        ]

        let result = ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: snapshot)

        #expect(result?.imprint.id == FixtureLibrary.imprints[0].id)
        #expect(result?.livedResult == .helped)
        #expect(result?.reason.contains("said it helped") == true)
    }

    @Test func doesNotResurfaceAnIdeaThePersonRejected() {
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [
            activeTask(
                title: "Protect a focused block for creative work",
                firstStep: "Make before consuming",
                area: .direction
            ),
            resultTask(sourceItemId: FixtureLibrary.imprints[2].id, outcome: .notForMe)
        ]

        let result = ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: snapshot)

        #expect(result?.imprint.id != FixtureLibrary.imprints[2].id)
    }

    @Test func canFindAUsefulSaveForTheNextCalendarEvent() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var snapshot = LifeSnapshot.empty
        snapshot.events = [LifeCalendarEvent(
            id: UUID(), externalId: nil, source: "calendar", calendarName: "Work",
            title: "Creative focus session", notes: "Protect attention and build before consuming", location: "Studio", url: nil,
            startAt: now.addingTimeInterval(3_600), endAt: now.addingTimeInterval(7_200), allDay: false, status: "confirmed",
            createdAt: now, updatedAt: now
        )]

        let result = ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: snapshot, now: now)

        #expect(result?.contextKind == .event)
        #expect(result?.contextTitle == "Creative focus session")
        #expect(result?.contextDetail?.contains("Today at") == true)
        #expect(result?.question.contains("carry into") == true)
    }

    @Test func canUseARecentAskQuestionAsCurrentContext() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let question = EvolutionRecentQuestion(
            question: "How can I protect my attention for creative work?",
            askedAt: now.formatted(.iso8601)
        )

        let result = ContextualReturnFinder.find(
            in: FixtureLibrary.imprints,
            snapshot: .empty,
            recentQuestion: question,
            now: now
        )

        #expect(result?.contextKind == .question)
        #expect(result?.contextTitle == question.question)
        #expect(result?.contextDetail == "From your recent Ask conversation")
        #expect(result?.question.contains("change how I might answer") == true)
    }

    @Test func learnsFromMemoryCheckInsAndNotTodayFeedback() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let source = FixtureLibrary.imprints[2]
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [activeTask(
            title: "Protect a focused block for creative work",
            firstStep: "Make before consuming",
            area: .direction
        )]
        let reflection = EvolutionReflection(
            id: UUID().uuidString,
            itemId: source.id.uuidString,
            response: "still_true",
            occurredAt: now.addingTimeInterval(-3 * 86_400).formatted(.iso8601)
        )
        let notToday = EvolutionReturnFeedback(
            id: UUID().uuidString,
            itemId: source.id.uuidString,
            response: "not_today",
            occurredAt: now.formatted(.iso8601)
        )

        let result = ContextualReturnFinder.find(
            in: FixtureLibrary.imprints,
            snapshot: snapshot,
            reflections: [reflection],
            returnFeedback: [notToday],
            now: now
        )

        #expect(result?.imprint.id != source.id)
    }

    @Test func offersOneConcreteActionFromTheSave() {
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [activeTask(
            title: "Protect a focused block for creative work",
            firstStep: "Make before consuming",
            area: .direction
        )]

        let result = ContextualReturnFinder.find(in: FixtureLibrary.imprints, snapshot: snapshot)

        #expect(result?.suggestedAction?.durationMinutes == 15)
        #expect(result?.suggestedAction?.title.isEmpty == false)
        #expect(result?.suggestedAction?.firstStep == result?.imprint.experiments.first)
    }

    @Test func doesNotReuseAFulfilledDatedReturnAsAContextualReturn() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var source = try #require(FixtureLibrary.imprints.first)
        source.returnCue = .date
        source.returnAt = now.addingTimeInterval(-86_400)
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [activeTask(title: "Rebuild deliberately after a difficult season", firstStep: "Name what this season clarified", area: .growth)]
        let checkIn = EvolutionReflection(
            id: UUID().uuidString, itemId: source.id.uuidString, response: "still_true", occurredAt: now.formatted(.iso8601)
        )

        #expect(ContextualReturnFinder.find(in: [source], snapshot: snapshot, now: now) != nil)
        #expect(ContextualReturnFinder.find(in: [source], snapshot: snapshot, reflections: [checkIn], now: now) == nil)
    }

    private func activeTask(title: String, firstStep: String, area: LifeArea) -> LifeTask {
        LifeTask(
            id: UUID(), goalId: nil, title: title, firstStep: firstStep, notes: "", area: area,
            status: .active, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "manual", completedAt: nil,
            createdAt: .now, updatedAt: .now
        )
    }

    private func resultTask(sourceItemId: UUID, outcome: PracticeOutcome) -> LifeTask {
        LifeTask(
            id: UUID(), goalId: nil, title: "A real-life test", firstStep: "Try it", notes: "", area: .growth,
            status: .done, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "practice", sourceItemId: sourceItemId,
            practiceOutcome: outcome, practiceReflection: "I noticed what actually happened.", reflectedAt: .now,
            completedAt: .now, createdAt: .now.addingTimeInterval(-86_400), updatedAt: .now
        )
    }
}
