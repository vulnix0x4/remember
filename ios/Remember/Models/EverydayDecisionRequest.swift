import Foundation

struct EverydayDecisionRequest: Encodable, Sendable {
    let availableMinutes: Int
    let energy: String
    let timeZone: String
    let excludedIds: [String]
    let startFocus: Bool
}
