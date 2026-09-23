import Testing
@testable import Remember

struct CarryForwardPlanTests {
    @Test func experimentBecomesAConciseTaskWithItsSourceAttached() {
        let imprint = FixtureLibrary.imprints[0]
        let experiment = "Write down one useful change this difficult season revealed."

        #expect(CarryForwardPlan.taskTitle(for: experiment) == "Write down one useful change this difficult season revealed")
        #expect(CarryForwardPlan.notes(for: imprint).contains(imprint.title))
        #expect(CarryForwardPlan.notes(for: imprint).contains(imprint.url.absoluteString))
    }

    @Test func experimentUsesTheLifeAreaSuggestedByTheSave() {
        #expect(CarryForwardPlan.area(for: FixtureLibrary.imprints[0]) == .growth)
        #expect(CarryForwardPlan.area(for: FixtureLibrary.imprints[2]) == .work)
    }
}

