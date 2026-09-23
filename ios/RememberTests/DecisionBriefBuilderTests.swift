import Testing
@testable import Remember

struct DecisionBriefBuilderTests {
    @Test func buildsAGroundedBriefWithAReversibleTest() {
        let brief = DecisionBriefBuilder.build(
            decision: "Should I protect more time for creative work?",
            context: "I keep consuming instead of making.",
            imprints: FixtureLibrary.imprints
        )

        #expect(brief.grounded)
        #expect(!brief.citations.isEmpty)
        #expect(brief.smallTest.count > 10)
        #expect(brief.nextQuestion.contains("learn"))
    }
}
