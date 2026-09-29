import Foundation

struct BrainSettings: Codable, Sendable, Equatable {
    var enabled: Bool
    var timeZone: String
    var startHour: Int
    var endHour: Int
    var preferences: String
    var sleep = SleepSettings()
}

extension BrainSettings {
    private enum CodingKeys: String, CodingKey { case enabled, timeZone, startHour, endHour, preferences, sleep }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        timeZone = try container.decode(String.self, forKey: .timeZone)
        startHour = try container.decode(Int.self, forKey: .startHour)
        endHour = try container.decode(Int.self, forKey: .endHour)
        preferences = try container.decode(String.self, forKey: .preferences)
        // Older servers don't send sleep yet.
        sleep = try container.decodeIfPresent(SleepSettings.self, forKey: .sleep) ?? SleepSettings()
    }
}
