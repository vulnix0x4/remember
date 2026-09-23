import Foundation
import Testing
@testable import Remember

struct SharedCaptureTests {
    @Test func enqueueDeduplicatesWithoutConsumingPendingURL() throws {
        let suite = "remember.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let url = try #require(URL(string: "https://example.com/item"))
        SharedCapture.enqueue(url, defaults: defaults)
        SharedCapture.enqueue(url, defaults: defaults)
        #expect(SharedCapture.pendingURLs(defaults: defaults) == [url])
        #expect(SharedCapture.pendingURLs(defaults: defaults) == [url])
    }

    @Test func failedAttemptLeavesURLPendingUntilAcknowledged() throws {
        let suite = "remember.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let url = try #require(URL(string: "https://example.com/retry"))

        SharedCapture.enqueue(url, defaults: defaults)
        let attemptedURLs = SharedCapture.pendingURLs(defaults: defaults)

        #expect(attemptedURLs == [url])
        #expect(SharedCapture.pendingURLs(defaults: defaults) == [url])
    }

    @Test func acknowledgementRemovesOnlyMatchingURL() throws {
        let suite = "remember.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let first = try #require(URL(string: "https://example.com/first"))
        let second = try #require(URL(string: "https://example.com/second"))

        SharedCapture.enqueue(first, defaults: defaults)
        SharedCapture.enqueue(second, defaults: defaults)
        SharedCapture.acknowledge(first, defaults: defaults)

        #expect(SharedCapture.pendingURLs(defaults: defaults) == [second])

        SharedCapture.acknowledge(second, defaults: defaults)
        #expect(SharedCapture.pendingURLs(defaults: defaults).isEmpty)
    }
}
