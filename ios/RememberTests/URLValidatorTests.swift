import Testing
@testable import Remember

struct URLValidatorTests {
    @Test func acceptsHTTPSURL() {
        #expect(URLValidator.validatedWebURL(from: " https://youtube.com/watch?v=abc ")?.host() == "youtube.com")
    }

    @Test func rejectsUnsafeAndIncompleteURLs() {
        #expect(URLValidator.validatedWebURL(from: "javascript:alert(1)") == nil)
        #expect(URLValidator.validatedWebURL(from: "youtube.com/video") == nil)
    }
}
