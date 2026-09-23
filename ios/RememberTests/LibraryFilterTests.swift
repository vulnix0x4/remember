import Testing
@testable import Remember

struct LibraryFilterTests {
    @Test func displayLabelsMapToTheCorrectKindsAndProcessingStates() {
        let ready = FixtureLibrary.imprints[0]
        let processing = FixtureLibrary.imprints[4]
        let failed = FixtureLibrary.imprints[5]
        let thought = FixtureLibrary.imprints[6]

        #expect(LibraryFilter.all.matches(ready))
        #expect(LibraryFilter.all.matches(failed))
        #expect(LibraryFilter.ready.matches(ready))
        #expect(!LibraryFilter.ready.matches(processing))
        #expect(LibraryFilter.processing.matches(processing))
        #expect(LibraryFilter.failed.matches(failed))
        #expect(!LibraryFilter.failed.matches(ready))
        #expect(LibraryFilter.thoughts.matches(thought))
        #expect(!LibraryFilter.thoughts.matches(ready))
    }
}
