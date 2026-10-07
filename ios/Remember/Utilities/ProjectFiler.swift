import Foundation

/// Projects are goals on the server. Tasks file themselves into them, so nobody has to sort anything.
/// Mirrors `apps/web/src/services/projects.ts`; the rules live in docs/REDESIGN.md under "Projects".
enum ProjectFiler {
    /// What the project chip says for a single task: let it file itself, keep it loose, or a chosen project.
    enum Pick: Equatable, Sendable {
        case auto
        case none
        case project(UUID)
    }

    private static let stopWords: Set<String> = [
        "a", "an", "the", "and", "or", "to", "of", "for", "in", "on", "at", "by", "with", "my", "me", "i", "it", "is", "be",
        "do", "get", "got", "go", "make", "need", "have", "gotta", "should", "want", "some", "this", "that", "up", "out",
        "about", "from", "task", "tasks", "thing", "things", "stuff", "work", "finish", "start",
    ]

    private struct Kit { let name: String; let words: String }

    private static let kits: [Kit] = [
        Kit(name: #"\b(college|school|class|course|uni|university|wgu|study|degree|semester)\b"#,
            words: #"\b(wgu|college|class|course|study|studying|exam|quiz|essay|paper|chapter|lecture|homework|assignment|mentor|professor|syllabus|rubric|midterm|semester|submit|submission|[a-z]\d{3,4})\b"#),
        Kit(name: #"\b(app|ios|code|coding|dev|software|website|startup)\b"#,
            words: #"\b(app|ios|swift|swiftui|xcode|testflight|app\s+store|bug|crash|build|deploy|release|ship|feature|screen|ui|ux|api|backend|frontend|code|refactor|commit|pr|merge|onboarding|paywall|simulator)\b"#),
        Kit(name: #"\b(gym|fitness|workout|training|health)\b"#,
            words: #"\b(gym|workout|lift|lifting|run|cardio|protein|stretch|mobility|legs|push|pull)\b"#),
    ]

    private static func matches(_ pattern: String, _ text: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    static func words(_ text: String) -> [String] {
        text.lowercased()
            .components(separatedBy: CharacterSet.letters.union(.decimalDigits).inverted)
            .filter { !$0.isEmpty && !stopWords.contains($0) }
    }

    /// Projects that new tasks can go into, oldest first so the order never jumps around.
    static func activeProjects(_ goals: [LifeGoal]) -> [LifeGoal] {
        goals.filter { $0.status == "active" }.sorted { $0.createdAt < $1.createdAt }
    }

    private static func score(_ title: String, titleWords: [String], project: LifeGoal, tasks: [LifeTask]) -> Int {
        var total = 0
        let nameWords = words(project.title).filter { $0.count >= 3 }
        if nameWords.contains(where: titleWords.contains) { total += 3 }
        if let kit = kits.first(where: { matches($0.name, project.title) }), matches(kit.words, title) { total += 2 }
        let earlier = tasks.filter { $0.goalId == project.id && $0.status != .removed }.map { Set(words($0.title)) }
        for word in Set(titleWords) {
            total += min(2, earlier.count { $0.contains(word) })
        }
        return total
    }

    /// Where a new task belongs: the project in focus, else the clear best match by its words, else
    /// nowhere (nil). A tie or a weak match stays loose, because loose is never wrong.
    static func file(_ title: String, goals: [LifeGoal], tasks: [LifeTask], focusProjectId: UUID? = nil) -> UUID? {
        let projects = activeProjects(goals)
        if let focusProjectId, projects.contains(where: { $0.id == focusProjectId }) { return focusProjectId }
        let titleWords = words(title)
        guard !titleWords.isEmpty else { return nil }
        let scored = projects
            .map { (id: $0.id, score: score(title, titleWords: titleWords, project: $0, tasks: tasks)) }
            .sorted { $0.score > $1.score }
        guard let best = scored.first, best.score >= 2 else { return nil }
        if scored.count > 1, scored[1].score == best.score { return nil }
        return best.id
    }

    /// Tapping the project chip: the next active project, then no project, and around again.
    static func next(after current: UUID?, goals: [LifeGoal]) -> Pick {
        let ids = activeProjects(goals).map(\.id)
        guard let first = ids.first else { return .none }
        guard let current, let index = ids.firstIndex(of: current) else { return current == nil ? .project(first) : .none }
        return index == ids.count - 1 ? .none : .project(ids[index + 1])
    }

    // MARK: Brain dump

    private static let filler = #"^(ok|okay|so|also|and|then|plus|oh|um|uh|like)\b[\s,]*"#
    private static let leadIn = #"^(i\s+need\s+to|i\s+have\s+to|i'?ve\s+got\s+to|i\s+gotta|i\s+should|i\s+want\s+to|need\s+to|have\s+to|gotta|remember\s+to|don'?t\s+forget\s+to)\s+"#
    /// Words that only say when, how long, or how important. A piece made only of these isn't a task.
    private static let detailWords: Set<String> = [
        "m", "min", "mins", "minute", "minutes", "h", "hr", "hrs", "hour", "hours", "half", "an", "a", "today", "tonight", "tomorrow",
        "tmrw", "tmr", "this", "weekend", "next", "week", "by", "on", "at", "every", "day", "days", "daily", "weekly", "monthly", "other",
        "urgent", "asap", "important", "once", "monday", "mon", "tuesday", "tue", "tues", "wednesday", "wed", "thursday", "thu", "thur",
        "thurs", "friday", "fri", "saturday", "sat", "sunday", "sun",
    ]

    private static func wordCount(_ text: String) -> Int {
        text.split(whereSeparator: \.isWhitespace).count
    }

    private static func realWordCount(_ text: String) -> Int {
        text.lowercased()
            .components(separatedBy: CharacterSet.letters.union(.decimalDigits).union(CharacterSet(charactersIn: "'")).inverted)
            .filter { !$0.isEmpty && Int($0) == nil && !detailWords.contains($0) }
            .count
    }

    private static func replacing(_ pattern: String, in text: String, with replacement: String = "") -> String {
        text.replacingOccurrences(of: pattern, with: replacement, options: [.regularExpression, .caseInsensitive])
    }

    private static func split(_ text: String, on pattern: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [text] }
        var pieces: [String] = []
        var start = text.startIndex
        for match in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let range = Range(match.range, in: text) else { continue }
            pieces.append(String(text[start..<range.lowerBound]))
            start = range.upperBound
        }
        pieces.append(String(text[start...]))
        return pieces
    }

    private static func clean(_ piece: String) -> String {
        var text = piece.trimmingCharacters(in: .whitespacesAndNewlines)
        var previous = ""
        while previous != text {
            previous = text
            text = replacing(leadIn, in: replacing(filler, in: text)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return replacing(#"[.?\s]+$"#, in: text).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Turns a messy paragraph into separate tasks. Returns the pieces when it found two or more,
    /// otherwise an empty array: the text is one ordinary task.
    static func splitDump(_ text: String) -> [String] {
        var pieces = split(text, on: #"\n|;|(?<=[.?])\s+"#)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        pieces = pieces.flatMap { piece -> [String] in
            let parts = piece.components(separatedBy: ",").map(clean).filter { !$0.isEmpty }
            return parts.count > 1 && parts.allSatisfy({ wordCount($0) >= 2 }) ? parts : [piece]
        }
        if pieces.count >= 2 {
            pieces = pieces.flatMap { piece -> [String] in
                let parts = split(clean(piece), on: #"\s+(and\s+then|and|then)\s+"#).map(clean)
                return parts.count > 1 && parts.allSatisfy({ wordCount($0) >= 2 }) ? parts : [piece]
            }
        }
        var merged: [String] = []
        for piece in pieces.map(clean) where !piece.isEmpty {
            if let last = merged.last, realWordCount(piece) < 1 {
                merged[merged.count - 1] = "\(last) \(piece)"
            } else {
                merged.append(piece)
            }
        }
        return merged.count >= 2 ? merged : []
    }
}
