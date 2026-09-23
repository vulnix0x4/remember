import Foundation

enum ReturnSchedule {
    enum InvalidDay: LocalizedError {
        case past
        var errorDescription: String? { "Choose today or a future day." }
    }

    static func instant(for day: Date, now: Date = .now, calendar: Calendar = .current) throws -> Date {
        let start = calendar.startOfDay(for: day)
        let today = calendar.startOfDay(for: now)
        guard start >= today else { throw InvalidDay.past }
        return start == today ? now : start
    }

    static func tomorrow(now: Date = .now, calendar: Calendar = .current) -> Date {
        calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
    }
}
