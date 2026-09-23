import Foundation

/// Turns one typed or spoken line into a task. Mirrors `apps/web/src/services/quickTask.ts`;
/// the rules live in docs/REDESIGN.md under "Quick add parsing".
struct ParsedQuickTask: Equatable, Sendable {
    var title: String
    var durationMinutes: Int?
    var notBefore: Date?
    var dueAt: Date?
    var repeatEveryDays: Int?
    var repeatSource: RepeatSource?
    var priority: LifeTaskPriority?

    /// Where the repeat came from: typed in the text, the usual rhythm for a known chore, or learned from past completions.
    enum RepeatSource: Equatable, Sendable { case typed, usual, learned }

    var hasDetails: Bool {
        durationMinutes != nil || notBefore != nil || dueAt != nil || repeatEveryDays != nil || priority != nil
    }
}

enum QuickTaskParser {
    /// A previously seen task, used to learn how often the person actually repeats something.
    struct HistoryEntry: Sendable {
        let title: String
        let completedAt: Date?
    }

    static func parse(_ text: String, now: Date = .now, calendar: Calendar = .current, history: [HistoryEntry] = []) -> ParsedQuickTask {
        let original = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var working = " \(original) "
        var result = ParsedQuickTask(title: original)

        func take(_ pattern: String) -> [String]? {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
            let range = NSRange(working.startIndex..., in: working)
            guard let match = regex.firstMatch(in: working, range: range) else { return nil }
            let groups = (0..<match.numberOfRanges).map { index -> String in
                guard let groupRange = Range(match.range(at: index), in: working) else { return "" }
                return String(working[groupRange])
            }
            if let fullRange = Range(match.range, in: working) {
                working.replaceSubrange(fullRange, with: " ")
            }
            return groups
        }

        // "once" turns automatic repeat off.
        let once = take(#"\b(just\s+once|one\s+time|once)\b"#) != nil

        // Repeat first, so "every week" is never read as "next week" or a weekday.
        if let match = take(#"\bevery\s+(\d{1,3})\s+days?\b"#), let days = Int(match[1]) {
            result.repeatEveryDays = min(365, max(1, days))
        } else if take(#"\bevery\s+other\s+day\b"#) != nil {
            result.repeatEveryDays = 2
        } else if take(#"\b(every\s*day|daily)\b"#) != nil {
            result.repeatEveryDays = 1
        } else if take(#"\b(every\s+week|weekly)\b"#) != nil {
            result.repeatEveryDays = 7
        } else if take(#"\b(every\s+month|monthly)\b"#) != nil {
            result.repeatEveryDays = 30
        }

        // Duration.
        if let match = take(#"\b(\d{1,3})\s*(m|min|mins|minute|minutes)\b"#), let minutes = Int(match[1]) {
            result.durationMinutes = clampDuration(minutes)
        } else if let match = take(#"\b(\d{1,2}(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b"#), let hours = Double(match[1]) {
            result.durationMinutes = clampDuration(Int((hours * 60).rounded()))
        } else if take(#"\bhalf\s+(an\s+)?hour\b"#) != nil {
            result.durationMinutes = 30
        } else if take(#"\ban\s+hour\b"#) != nil {
            result.durationMinutes = 60
        }

        // Priority.
        if take(#"(^|\s)!!(\s|$)"#) != nil || take(#"\burgent\b"#) != nil {
            result.priority = .must
        } else if take(#"(^|\s)!(\s|$)"#) != nil || take(#"\b(asap|important)\b"#) != nil {
            result.priority = .high
        }

        // When. "by <day>" sets a deadline; everything else sets the earliest start.
        let dayWords = #"(today|tonight|tomorrow|tmrw|tmr|this\s+weekend|weekend|next\s+week|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)"#
        if let match = take(#"\bby\s+"# + dayWords + #"\b"#) {
            if let day = resolveDay(match[1], now: now, calendar: calendar) {
                result.dueAt = at(hour: 17, on: day, calendar: calendar)
            }
        } else if let match = take(#"\b(?:on\s+|next\s+(?=mon|tue|wed|thu|fri|sat|sun))?"# + dayWords + #"\b"#) {
            let word = match[1].lowercased()
            if word == "tonight" {
                let tonight = at(hour: 18, on: now, calendar: calendar)
                if tonight > now { result.notBefore = tonight }
            } else if word != "today", let day = resolveDay(word, now: now, calendar: calendar) {
                result.notBefore = at(hour: 9, on: day, calendar: calendar)
            }
        }

        var title = working.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        while let trailing = title.range(of: #"(\s+(on|by|at)|\s*[,\-])$"#, options: [.regularExpression, .caseInsensitive]) {
            title.removeSubrange(trailing)
            title = title.trimmingCharacters(in: .whitespaces)
        }
        if title.isEmpty { return ParsedQuickTask(title: original) }
        result.title = title.prefix(1).uppercased() + title.dropFirst()
        if result.repeatEveryDays != nil {
            result.repeatSource = .typed
        } else if !once {
            if let learned = learnedRepeatDays(for: result.title, history: history, now: now) {
                result.repeatEveryDays = learned
                result.repeatSource = .learned
            } else if let usual = usualRepeatDays(for: result.title) {
                result.repeatEveryDays = usual
                result.repeatSource = .usual
            }
        }
        return result
    }

    /// How often common chores usually repeat, in days. First match wins. Mirrors docs/REDESIGN.md.
    private static let usualRhythms: [(pattern: String, days: Int)] = [
        (#"\b(dishes|make\s+(the\s+|my\s+)?bed|meds|medication|pills|vitamins|walk\s+(the\s+)?dog|feed\s+(the\s+)?(dog|cat|pets?)|floss|journal|skincare)\b"#, 1),
        (#"\bwater\s+(the\s+)?plants\b"#, 3),
        (#"\b(sheets|bedding|change\s+(the\s+)?bed)\b"#, 14),
        (#"\b(laundry|vacuum|mop|groceries|grocery|trash|garbage|recycling|bins|dust|meal\s+prep|clean\s+(the\s+)?(bathroom|kitchen|room|house|apartment)|mow\s+(the\s+)?lawn|weekly\s+review|plan\s+(the\s+|my\s+)?week|call\s+(mom|dad|grandma|grandpa|parents))\b"#, 7),
        (#"\b(rent|bills?|credit\s+card|mortgage|haircut|budget|wash\s+(the\s+)?car|car\s+wash|clean\s+(the\s+)?fridge|back\s*up)\b"#, 30),
        (#"\b(air\s+filter|hvac\s+filter|furnace\s+filter|toothbrush|oil\s+change|change\s+(the\s+)?oil)\b"#, 90),
        (#"\b(dentist|teeth\s+cleaning)\b"#, 180),
        (#"\b(checkup|check-up|eye\s+exam|registration)\b"#, 365),
    ]
    private static let rhythmSteps = [1, 2, 3, 7, 14, 30, 90, 180, 365]

    static func usualRepeatDays(for title: String) -> Int? {
        usualRhythms.first { title.range(of: $0.pattern, options: [.regularExpression, .caseInsensitive]) != nil }?.days
    }

    /// The person's own rhythm for a title: the gap between the last two completions, or since the only one.
    static func learnedRepeatDays(for title: String, history: [HistoryEntry], now: Date = .now) -> Int? {
        let key = title.trimmingCharacters(in: .whitespaces).lowercased()
        let completions = history
            .filter { $0.title.trimmingCharacters(in: .whitespaces).lowercased() == key }
            .compactMap(\.completedAt)
            .sorted(by: >)
        guard let latest = completions.first else { return nil }
        let gap = (completions.count > 1 ? latest.timeIntervalSince(completions[1]) : now.timeIntervalSince(latest)) / 86_400
        guard gap >= 0.5 else { return nil }
        return rhythmSteps.min { abs(Double($0) - gap) < abs(Double($1) - gap) }
    }

    private static func clampDuration(_ minutes: Int) -> Int { min(720, max(2, minutes)) }

    private static func at(hour: Int, on day: Date, calendar: Calendar) -> Date {
        calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day) ?? day
    }

    private static func resolveDay(_ rawWord: String, now: Date, calendar: Calendar) -> Date? {
        let word = rawWord.lowercased().replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let today = calendar.startOfDay(for: now)
        func adding(_ days: Int) -> Date? { calendar.date(byAdding: .day, value: days, to: today) }
        func next(weekday: Int, allowToday: Bool = false) -> Date? {
            let current = calendar.component(.weekday, from: today)
            var delta = (weekday - current + 7) % 7
            if delta == 0 && !allowToday { delta = 7 }
            return adding(delta)
        }
        switch word {
        case "today", "tonight": return today
        case "tomorrow", "tmrw", "tmr": return adding(1)
        case "this weekend", "weekend":
            let saturdayMorningPassed = at(hour: 9, on: now, calendar: calendar) <= now
            return next(weekday: 7, allowToday: !saturdayMorningPassed)
        case "next week": return next(weekday: 2)
        case "sunday", "sun": return next(weekday: 1)
        case "monday", "mon": return next(weekday: 2)
        case "tuesday", "tue", "tues": return next(weekday: 3)
        case "wednesday", "wed": return next(weekday: 4)
        case "thursday", "thu", "thur", "thurs": return next(weekday: 5)
        case "friday", "fri": return next(weekday: 6)
        case "saturday", "sat": return next(weekday: 7)
        default: return nil
        }
    }
}
