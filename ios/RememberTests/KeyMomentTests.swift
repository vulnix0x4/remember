import Foundation
import Testing
@testable import Remember

struct KeyMomentTests {
    @Test func formatsTimestampWithLeadingZero() {
        let moment = KeyMoment(id: UUID(), seconds: 125, title: "", detail: "")
        #expect(moment.timestamp == "2:05")
    }
}
