import Foundation
import Testing
@testable import Remember

struct PersonalCompassBuilderTests {
    @Test func separatesChosenTruthsExperimentsAndChangedViews() throws {
        let source = try #require(FixtureLibrary.imprints.first)
        let timestamp = Date.now
        let activeTask = LifeTask(
            id: UUID(), goalId: nil, title: "Try the idea", firstStep: "Begin", notes: CarryForwardPlan.notes(for: source),
            area: .growth, status: .active, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "practice", completedAt: nil,
            createdAt: timestamp, updatedAt: timestamp
        )
        let completedTask = LifeTask(
            id: UUID(), goalId: nil, title: "Finished test", firstStep: "Reflect", notes: CarryForwardPlan.notes(for: source),
            area: .growth, status: .done, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "practice", sourceItemId: source.id,
            practiceOutcome: .helped, practiceReflection: "Starting first changed the whole session.", reflectedAt: timestamp, completedAt: timestamp,
            createdAt: timestamp, updatedAt: timestamp
        )
        let overview = EvolutionOverview(
            themes: [],
            principles: [
                EvolutionPrinciple(id: UUID().uuidString, itemId: source.id.uuidString, text: "Kept", rationale: nil, status: "active", createdAt: nil),
                EvolutionPrinciple(id: UUID().uuidString, itemId: source.id.uuidString, text: "Proposed", rationale: nil, status: "candidate", createdAt: nil),
            ],
            tensions: [],
            timeline: [],
            reflections: [EvolutionReflection(id: UUID().uuidString, itemId: source.id.uuidString, response: "changed_mind", occurredAt: "2026-08-30T12:00:00Z")],
            returnFeedback: [],
            recentQuestion: nil
        )
        var life = LifeSnapshot.empty
        life.tasks = [activeTask, completedTask]

        let compass = PersonalCompassBuilder.build(overview: overview, life: life, imprints: [source])

        #expect(compass.truths.map(\.text) == ["Kept"])
        #expect(compass.suggestions.map(\.text) == ["Proposed"])
        #expect(compass.activeExperiments.first?.imprint?.id == source.id)
        #expect(compass.completedExperiments.first?.task.id == completedTask.id)
        #expect(compass.completedExperiments.first?.task.practiceOutcome == .helped)
        #expect(compass.completedExperiments.first?.task.practiceReflection == "Starting first changed the whole session.")
        #expect(compass.guidance.first?.kind == .keep)
        #expect(compass.guidance.first?.principle?.text == "Kept")
        #expect(compass.changes.first?.statement.contains("no longer feels the same") == true)
    }

    @Test func turnsEveryExperimentOutcomeIntoClearGuidance() throws {
        let source = try #require(FixtureLibrary.imprints.first)
        let overview = EvolutionOverview(
            themes: [], principles: [], tensions: [], timeline: [], reflections: [], returnFeedback: [], recentQuestion: nil
        )
        let cases: [(PracticeOutcome, CompassGuidanceKind)] = [
            (.helped, .keep),
            (.mixed, .adjust),
            (.notForMe, .release),
        ]

        for (outcome, expectedKind) in cases {
            let timestamp = Date.now
            let task = LifeTask(
                id: UUID(), goalId: nil, title: "Try the idea", firstStep: "Begin", notes: CarryForwardPlan.notes(for: source),
                area: .growth, status: .done, priority: .normal, energy: .any, durationMinutes: 15,
                dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "practice", sourceItemId: source.id,
                practiceOutcome: outcome, practiceReflection: "What happened", reflectedAt: timestamp, completedAt: timestamp,
                createdAt: timestamp, updatedAt: timestamp
            )
            var life = LifeSnapshot.empty
            life.tasks = [task]

            let compass = PersonalCompassBuilder.build(overview: overview, life: life, imprints: [source])

            #expect(compass.guidance.first?.kind == expectedKind)
        }
    }
}
