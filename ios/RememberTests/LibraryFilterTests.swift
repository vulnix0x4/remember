import Testing
@testable import Remember

struct LibraryFilterTests {
    @Test func displayLabelsMapToTheCorrectProcessingStates() {
        #expect(LibraryFilter.all.matches(.ready))
        #expect(LibraryFilter.all.matches(.failed))
        #expect(LibraryFilter.ready.matches(.ready))
        #expect(!LibraryFilter.ready.matches(.processing))
        #expect(LibraryFilter.processing.matches(.processing))
        #expect(LibraryFilter.partial.matches(.partial))
        #expect(LibraryFilter.failed.matches(.failed))
        #expect(!LibraryFilter.failed.matches(.partial))
    }
}
