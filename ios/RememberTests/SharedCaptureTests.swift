import Foundation
import Testing
@testable import Remember

struct SharedCaptureTests {
    @Test func enqueueDeduplicatesAndDrainClears() throws {
        let suite = "remember.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let url = try #require(URL(string: "https://example.com/item"))
        SharedCapture.enqueue(url, defaults: defaults)
        SharedCapture.enqueue(url, defaults: defaults)
        #expect(SharedCapture.drain(defaults: defaults) == [url])
        #expect(SharedCapture.drain(defaults: defaults).isEmpty)
    }
}
