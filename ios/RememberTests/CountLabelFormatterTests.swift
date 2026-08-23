import Testing
@testable import Remember

struct CountLabelFormatterTests {
    @Test func formatsZeroOneAndManyWithoutExposingMarkup() {
        #expect(CountLabelFormatter.text(0, singular: "imprint") == "0 imprints")
        #expect(CountLabelFormatter.text(1, singular: "imprint") == "1 imprint")
        #expect(CountLabelFormatter.text(2, singular: "imprint") == "2 imprints")
    }

    @Test func supportsAnExplicitIrregularPlural() {
        #expect(CountLabelFormatter.text(2, singular: "memory", plural: "memories") == "2 memories")
    }
}
