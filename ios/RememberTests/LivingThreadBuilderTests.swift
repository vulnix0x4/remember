import Testing
@testable import Remember

struct LivingThreadBuilderTests {
    @Test func repeatedThemesBecomeChronologicalThreads() {
        let threads = LivingThreadBuilder.build(from: FixtureLibrary.imprints)
        let identity = threads.first(where: { $0.name == "Identity" })

        #expect(identity?.saves.count == 2)
        #expect(identity?.earliest.title == "Your worst years are not wasted years")
        #expect(identity?.latest.title == "The courage to be disliked")
        #expect(identity?.question.contains("thinking about identity") == true)
    }

    @Test func unfinishedAndOneOffThemesDoNotBecomeThreads() {
        let threads = LivingThreadBuilder.build(from: FixtureLibrary.imprints)

        #expect(threads.contains(where: { $0.name == "Building" }) == false)
        #expect(threads.contains(where: { $0.name == "Relationships" }) == false)
    }

    @Test func memoryCheckInsBecomeTurningPointsAndShapeTheNextQuestion() {
        let target = FixtureLibrary.imprints.first(where: { $0.themes.contains("Identity") })!
        let reflection = EvolutionReflection(
            id: "reflection-shift",
            itemId: target.id.uuidString,
            response: "changed_mind",
            occurredAt: "2026-08-30T12:00:00Z"
        )

        let identity = LivingThreadBuilder
            .build(from: FixtureLibrary.imprints, reflections: [reflection])
            .first(where: { $0.name == "Identity" })

        #expect(identity?.turningPoints.first?.label == "Your view shifted here")
        #expect(identity?.pulse.kind == .shifting)
        #expect(identity?.pulse.label == "Your thinking is changing")
        #expect(identity?.question == "What changed my mind about identity, and what do I seem to believe instead?")
    }
}
