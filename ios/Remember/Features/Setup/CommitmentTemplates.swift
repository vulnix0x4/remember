import Foundation

/// Weekday bitmask helpers: Sunday = 1, Monday = 2 … Saturday = 64.
enum Weekdays {
    static let everyDay = 127
    static let weekdays = 2 | 4 | 8 | 16 | 32
    static let letters = ["S", "M", "T", "W", "T", "F", "S"]
    static let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    static func contains(_ mask: Int, _ weekday: Int) -> Bool { mask & (1 << weekday) != 0 }

    static func label(_ mask: Int) -> String {
        if mask == everyDay { return "Every day" }
        if mask == weekdays { return "Weekdays" }
        if mask == 1 | 64 { return "Weekends" }
        let short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return (0..<7).filter { contains(mask, $0) }.map { short[$0] }.joined(separator: ", ")
    }
}

extension Commitment {
    /// "Every day · 2 hr" or "Laundry · weekly".
    var summary: String {
        var parts: [String] = []
        if let everyDays {
            parts.append(everyDays.repeatLabel)
            if days != Weekdays.everyDay { parts.append(Weekdays.label(days)) }
        } else {
            parts.append(Weekdays.label(days))
        }
        if let fixedStart { parts.append("at \(CommitmentTime.label(fixedStart))") }
        parts.append(durationMinutes.durationLabel)
        return parts.joined(separator: " · ")
    }
}

enum CommitmentTime {
    /// "18:30" → "6:30 PM".
    static func label(_ value: String) -> String {
        guard let date = date(from: value) else { return value }
        return date.formatted(date: .omitted, time: .shortened)
    }

    static func date(from value: String) -> Date? {
        let parts = value.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: .now)
    }

    static func string(from date: Date) -> String {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }
}

/// Ready-made commitments and chores offered in setup and Settings. Mirrors docs/REDESIGN.md.
enum CommitmentTemplates {
    static let laundrySteps: [RoutineStep] = [
        RoutineStep(title: "Gather dirty clothes"),
        RoutineStep(title: "Start the washer"),
        RoutineStep(title: "Washer running", waitMinutes: 45),
        RoutineStep(title: "Move clothes to the dryer"),
        RoutineStep(title: "Dryer running", waitMinutes: 50),
        RoutineStep(title: "Fold everything"),
        RoutineStep(title: "Put it all away"),
    ]

    static let commitments: [CommitmentDraft] = [
        CommitmentDraft(title: "College study", kind: .commitment, days: Weekdays.everyDay, durationMinutes: 120, importance: .must),
        CommitmentDraft(title: "Coursework", kind: .commitment, days: Weekdays.weekdays, durationMinutes: 60, importance: .must),
        CommitmentDraft(title: "Gym", kind: .commitment, days: 2 | 8 | 32, durationMinutes: 60, importance: .high),
        CommitmentDraft(title: "Walk", kind: .commitment, days: Weekdays.everyDay, durationMinutes: 20, importance: .normal),
    ]

    static let chores: [CommitmentDraft] = [
        CommitmentDraft(title: "Laundry", kind: .chore, everyDays: 7, durationMinutes: 30, importance: .high, steps: laundrySteps),
        CommitmentDraft(title: "Dishes", kind: .chore, everyDays: 1, durationMinutes: 15, importance: .high),
        CommitmentDraft(title: "Take out trash", kind: .chore, everyDays: 7, durationMinutes: 5, importance: .high),
        CommitmentDraft(title: "Groceries", kind: .chore, everyDays: 7, durationMinutes: 45, importance: .high),
        CommitmentDraft(title: "Clean bathroom", kind: .chore, everyDays: 7, durationMinutes: 30, importance: .normal),
        CommitmentDraft(title: "Change sheets", kind: .chore, everyDays: 14, durationMinutes: 15, importance: .normal),
    ]

    static func templates(for kind: CommitmentKind) -> [CommitmentDraft] {
        kind == .chore ? chores : commitments
    }
}
