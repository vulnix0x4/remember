import Foundation

struct KeyMoment: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let seconds: Int
    let title: String
    let detail: String

    var timestamp: String {
        let minutes = seconds / 60
        let remainder = seconds % 60
        return "\(minutes):\(remainder.formatted(.number.precision(.integerLength(2))))"
    }
}
