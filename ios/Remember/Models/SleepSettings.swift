import Foundation

/// Sleep settings, stored with Jev's settings so every device shares them. No set times: the night
/// runs from Going to bed to I'm up.
struct SleepSettings: Codable, Hashable, Sendable {
    /// Phone-free nights: the Going to bed button, the phone-free screen, and the morning check-in.
    var enabled = false
    /// Phone-free time after I'm up.
    var morningMinutes = 60
    /// A nudge 8 hours before the usual bedtime, once Remember knows it.
    var caffeineReminder = true

    private enum CodingKeys: String, CodingKey { case enabled, morningMinutes, caffeineReminder }

    init(enabled: Bool = false, morningMinutes: Int = 60, caffeineReminder: Bool = true) {
        self.enabled = enabled
        self.morningMinutes = morningMinutes
        self.caffeineReminder = caffeineReminder
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
        morningMinutes = try container.decodeIfPresent(Int.self, forKey: .morningMinutes) ?? 60
        caffeineReminder = try container.decodeIfPresent(Bool.self, forKey: .caffeineReminder) ?? true
    }
}

/// Clock math and the tip, mirroring `@remember/domain`'s sleep helpers exactly.
enum SleepMath {
    static let minNights = 3

    static func minutes(_ time: String) -> Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 0) * 60 + (parts.dropFirst().first ?? 0)
    }

    static func time(_ minutes: Int) -> String {
        let wrapped = ((minutes % 1440) + 1440) % 1440
        return String(format: "%02d:%02d", wrapped / 60, wrapped % 60)
    }

    /// Minutes after 6 PM, so times on either side of midnight compare simply (11 PM = 300, 2 AM = 480).
    static func afterEvening(_ time: String) -> Int {
        (minutes(time) - 18 * 60 + 1440) % 1440
    }

    static func afterEvening(_ date: Date, calendar: Calendar = .current) -> Int {
        afterEvening(time(of: date, calendar: calendar))
    }

    /// The middle value, or nil for none.
    static func median(_ values: [Int]) -> Int? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted(), middle = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[middle] : Int((Double(sorted[middle - 1] + sorted[middle]) / 2).rounded())
    }

    /// "HH:MM" for a real date.
    static func time(of date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return time((parts.hour ?? 0) * 60 + (parts.minute ?? 0))
    }

    /// "12:40 AM" for minutes after 6 PM.
    static func label(afterEvening minutes: Int, calendar: Calendar = .current) -> String {
        let clock = self.minutes(time(minutes + 18 * 60))
        let date = calendar.date(bySettingHour: clock / 60, minute: clock % 60, second: 0, of: .now) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// "1 hr 30 min", "2 hr", "45 min".
    static func durationLabel(minutes: Int) -> String {
        let total = max(0, minutes)
        let hours = total / 60, rest = total % 60
        if hours == 0 { return "\(rest) min" }
        return rest == 0 ? "\(hours) hr" : "\(hours) hr \(rest) min"
    }
}

/// A week of nights, reduced to the numbers the tip needs. Times are minutes after 6 PM.
struct SleepWeekNumbers: Equatable {
    var nights: Int
    var averageHours: Double?
    var usualBedtime: Int?
    var bedtimeRangeMinutes: Int?
    var wakeRangeMinutes: Int?
    var averageLatencyMinutes: Int?
    var latencyAnswers: Int
    /// For the chart's second line.
    var usualWake: Int?
}

struct SleepTip: Equatable {
    var title: String
    var line: String

    /// The one tip worth acting on. The first rule that matches wins.
    init(_ week: SleepWeekNumbers) {
        if week.nights < SleepMath.minNights {
            self.init(title: "Two taps a day", line: "Going to bed at night, I’m up in the morning. That’s how Remember learns your nights.")
        } else if (week.wakeRangeMinutes ?? 0) > 60 {
            self.init(title: "Same wake-up time, every day", line: "Weekends too. It’s the single biggest fix.")
        } else if (week.bedtimeRangeMinutes ?? 0) > 90 {
            self.init(title: "Keep bedtime steady",
                      line: "Your bedtime moved by \(SleepMath.durationLabel(minutes: week.bedtimeRangeMinutes ?? 0)) this week. Steadier nights make easier mornings.")
        } else if week.latencyAnswers >= SleepMath.minNights, (week.averageLatencyMinutes ?? 0) > 45 {
            self.init(title: "Slow to fall asleep?", line: "Give the wind-down a real hour. If you’re awake after 20 minutes, get up for a bit.")
        } else if let hours = week.averageHours, hours < 7 {
            self.init(title: "You’re short on sleep", line: "About \(String(format: "%.1f", hours)) hr a night. Try Going to bed 30 minutes earlier.")
        } else if let bedtime = week.usualBedtime, bedtime > SleepMath.afterEvening("01:00") {
            self.init(title: "Get daylight early", line: "10 minutes outside within an hour of waking moves your body clock earlier.")
        } else {
            self.init(title: "You’re on track", line: "Keep your nights steady, even on weekends.")
        }
    }

    init(title: String, line: String) {
        self.title = title
        self.line = line
    }
}

extension Double {
    /// "7 hr 5 min", "8 hr", "45 min".
    var sleepDurationLabel: String { SleepMath.durationLabel(minutes: Int((self * 60).rounded())) }
}
