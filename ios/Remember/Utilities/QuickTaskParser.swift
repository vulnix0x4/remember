import Foundation

/// Turns one typed or spoken line into a task. Mirrors `apps/web/src/services/quickTask.ts`;
/// the rules live in docs/REDESIGN.md under "Quick add parsing".
struct ParsedQuickTask: Equatable, Sendable {
    var title: String
    var durationMinutes: Int?
    var notBefore: Date?
    var dueAt: Date?
    var repeatEveryDays: Int?
    var priority: LifeTaskPriority?

    var hasDetails: Bool {
        durationMinutes != nil || notBefore != nil || dueAt != nil || repeatEveryDays != nil || priority != nil
    }
}

enum QuickTaskParser {
    static func parse(_ text: String, now: Date = .now, calendar: Calendar = .current) -> ParsedQuickTask {
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
        return result
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
