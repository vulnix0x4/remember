import Foundation

enum ContextualReturnFinder {
    private struct CurrentContext {
        let kind: ContextualReturnKind
        let title: String
        let area: LifeArea
        let material: String
        let detail: String?
        let priority: Int
    }

    private struct Candidate {
        let imprint: Imprint
        let context: CurrentContext
        let overlap: [String]
        let sameArea: Bool
        let score: Int
        let matchedTheme: String?
        let livedResult: PracticeOutcome?
        let reflection: EvolutionReflection?
    }

    private static let ignoredWords: Set<String> = [
        "about", "after", "again", "also", "been", "before", "being", "could", "from", "have",
        "into", "just", "more", "only", "other", "should", "that", "their", "there", "these",
        "thing", "this", "through", "today", "what", "when", "where", "which", "with", "would", "your"
    ]
    private static let day: TimeInterval = 86_400

    static func find(
        in imprints: [Imprint],
        snapshot: LifeSnapshot,
        reflections: [EvolutionReflection] = [],
        returnFeedback: [EvolutionReturnFeedback] = [],
        recentQuestion: EvolutionRecentQuestion? = nil,
        excluding: Set<UUID> = [],
        now: Date = .now
    ) -> ContextualReturn? {
        let contexts = currentContexts(in: snapshot, recentQuestion: recentQuestion, now: now)
        guard !contexts.isEmpty else { return nil }

        let eligibility = ReturnEligibility(reflections: reflections, returnFeedback: returnFeedback, tasks: snapshot.tasks, now: now)

        let candidates = imprints.flatMap { imprint -> [Candidate] in
            guard !excluding.contains(imprint.id), eligibility.allows(imprint) else { return [] }
            let livedResult = eligibility.practiceResults[imprint.id]?.practiceOutcome
            let reflection = eligibility.reflections[imprint.id]
            let feedback = eligibility.feedback[imprint.id]

            let imprintTokens = tokens(in: ([imprint.title, imprint.essence, imprint.summary] + imprint.themes + imprint.keyIdeas).joined(separator: " "))
            return contexts.compactMap { context in
                let contextTokens = tokens(in: context.material)
                let overlap = contextTokens.filter(imprintTokens.contains).sorted()
                let sameArea = CarryForwardPlan.area(for: imprint) == context.area
                let relevance = overlap.count * 3
                    + (sameArea && context.area != .direction ? 5 : 0)
                    + (imprint.reaction?.isEmpty == false ? 1 : 0)
                guard relevance > 0 else { return nil }
                let reflectionBoost = switch reflection?.response {
                case "still_true": 4
                case "changed_mind": 2
                case "not_sure": 1
                default: 0
                }
                let usefulBoost = feedback?.response == "useful" ? 4 : 0
                let resultBoost = livedResult == .helped ? 7 : livedResult == .mixed ? 2 : 0
                let matchedTheme = imprint.themes.first { !tokens(in: $0).isDisjoint(with: contextTokens) }
                return Candidate(
                    imprint: imprint,
                    context: context,
                    overlap: overlap,
                    sameArea: sameArea,
                    score: relevance + context.priority + reflectionBoost + usefulBoost + resultBoost,
                    matchedTheme: matchedTheme,
                    livedResult: livedResult,
                    reflection: reflection
                )
            }
        }
        .sorted { left, right in
            left.score == right.score ? left.imprint.savedAt > right.imprint.savedAt : left.score > right.score
        }

        guard let best = candidates.first else { return nil }
        let connection = best.matchedTheme ?? (best.sameArea ? best.context.area.rawValue : best.overlap.first ?? "a shared idea")
        let label = best.context.kind.contextLabel
        let reason = switch (best.livedResult, best.reflection?.response) {
        case (.some(.helped), _):
            "You tried this before and said it helped. It connects to your \(label), “\(best.context.title),” through \(connection)."
        case (.some(.mixed), _):
            "Part of this helped before. It connects to your \(label), “\(best.context.title),” through \(connection)."
        case (_, "still_true"):
            "You said this still feels true. Remember brought it back because it connects to your \(label), “\(best.context.title).”"
        case (_, "changed_mind"):
            "Your view of this has changed. That makes it useful to reconsider beside your \(label), “\(best.context.title).”"
        default:
            "Remember connected this save to your \(label), “\(best.context.title),” through \(connection)."
        }
        let question = switch best.context.kind {
        case .question:
            "How does “\(best.imprint.title)” change how I might answer “\(best.context.title)” now?"
        case .event:
            "What from “\(best.imprint.title)” do I want to carry into “\(best.context.title)”?"
        default:
            "What from “\(best.imprint.title)” could help me with “\(best.context.title)” today?"
        }
        let action = best.imprint.experiments.first.map {
            ContextualReturnAction(title: CarryForwardPlan.taskTitle(for: $0), firstStep: $0, durationMinutes: 15)
        }
        return ContextualReturn(
            imprint: best.imprint,
            contextKind: best.context.kind,
            contextTitle: best.context.title,
            contextArea: best.context.area,
            contextDetail: best.context.detail,
            connection: connection,
            reason: reason,
            question: question,
            livedResult: best.livedResult,
            suggestedAction: action
        )
    }

    private static func currentContexts(
        in snapshot: LifeSnapshot,
        recentQuestion: EvolutionRecentQuestion?,
        now: Date
    ) -> [CurrentContext] {
        var contexts: [CurrentContext] = []
        if let task = snapshot.tasks.first(where: { $0.status == .active }) {
            let material = "\(task.title) \(task.firstStep) \(task.notes)"
            contexts.append(CurrentContext(kind: .task, title: task.title, area: resolvedArea(task.area, material: material), material: material, detail: task.firstStep.isEmpty ? nil : task.firstStep, priority: 7))
        }
        if let event = snapshot.events
            .filter({ $0.status != "cancelled" && $0.endAt > now && $0.startAt <= now.addingTimeInterval(36 * 60 * 60) })
            .sorted(by: { $0.startAt < $1.startAt })
            .first {
            let material = "\(event.title) \(event.notes) \(event.location) \(event.calendarName)"
            let dayLabel = Calendar.current.isDate(event.startAt, inSameDayAs: now) ? "Today" : "Tomorrow"
            let detail = event.allDay
                ? "\(dayLabel), all day"
                : "\(dayLabel) at \(event.startAt.formatted(date: .omitted, time: .shortened))"
            contexts.append(CurrentContext(kind: .event, title: event.title, area: CarryForwardPlan.area(for: material), material: material, detail: detail, priority: 6))
        }
        if let recentQuestion,
           let askedAt = date(from: recentQuestion.askedAt),
           askedAt >= now.addingTimeInterval(-14 * day) {
            contexts.append(CurrentContext(kind: .question, title: recentQuestion.question, area: CarryForwardPlan.area(for: recentQuestion.question), material: recentQuestion.question, detail: "From your recent Ask conversation", priority: 8))
        }
        if let goal = snapshot.goals.first(where: { $0.status == "active" }) {
            let material = "\(goal.title) \(goal.vision) \(goal.why)"
            contexts.append(CurrentContext(kind: .goal, title: goal.title, area: resolvedArea(goal.area, material: material), material: material, detail: goal.why.isEmpty ? (goal.vision.isEmpty ? nil : goal.vision) : goal.why, priority: 4))
        }
        return contexts
    }

    private static func resolvedArea(_ area: LifeArea, material: String) -> LifeArea {
        area == .direction ? CarryForwardPlan.area(for: material) : area
    }

    private static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private static func tokens(in value: String) -> Set<String> {
        Set(value.lowercased().split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .filter { $0.count >= 4 && !ignoredWords.contains($0) })
    }
}
