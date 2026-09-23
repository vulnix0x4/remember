import Foundation
import Testing
@testable import Remember

struct AskOutcomeBuilderTests {
    @Test func usesTheStrongestCitedSaveWithSomethingToKeepOrTry() {
        let citations = [FixtureLibrary.imprints[4], FixtureLibrary.imprints[2], FixtureLibrary.imprints[0]].map { imprint in
            Citation(id: UUID(), itemID: imprint.id, title: imprint.title, seconds: nil, url: imprint.url, excerpt: imprint.essence)
        }
        let message = AskMessage(id: UUID(), role: .assistant, text: "A grounded answer", citations: citations, grounded: true, limitations: [])

        let outcome = AskOutcomeBuilder.build(for: message, imprints: FixtureLibrary.imprints)

        #expect(outcome?.imprint.id == FixtureLibrary.imprints[2].id)
        #expect(outcome?.experiment == "Remove one recurring input that does not deserve a place in your week.")
        #expect(outcome?.principle == "Treat attention as evidence of what you value.")
    }

    @Test func doesNotInventAnOutcomeForAnUngroundedAnswer() {
        let message = AskMessage(id: UUID(), role: .assistant, text: "No evidence", citations: [], grounded: false, limitations: [])
        #expect(AskOutcomeBuilder.build(for: message, imprints: FixtureLibrary.imprints) == nil)
    }
}
