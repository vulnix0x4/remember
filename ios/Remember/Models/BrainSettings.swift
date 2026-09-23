import Foundation

struct BrainSettings: Codable, Sendable, Equatable {
    var enabled: Bool
    var timeZone: String
    var startHour: Int
    var endHour: Int
    var preferences: String
}
