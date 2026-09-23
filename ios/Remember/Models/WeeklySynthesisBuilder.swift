import Foundation

enum WeeklySynthesisBuilder {
    private static let week: TimeInterval = 7 * 24 * 60 * 60

    static func build(imprints: [Imprint], life: LifeSnapshot, now: Date = .now) -> WeeklySynthesis? {
        let start = now.addingTimeInterval(-week)
        let recentImprints = imprints.filter { $0.savedAt >= start && $0.savedAt <= now }
        let recentExperiments = life.tasks
            .filter { $0.source == "practice" && $0.status == .done }
            .filter {
                let occurredAt = $0.reflectedAt ?? $0.completedAt ?? $0.updatedAt
                return occurredAt >= start && occurredAt <= now
            }
            .sorted { ($0.reflectedAt ?? $0.completedAt ?? $0.updatedAt) > ($1.reflectedAt ?? $1.completedAt ?? $1.updatedAt) }

        guard !recentImprints.isEmpty || !recentExperiments.isEmpty else { return nil }

        let task = recentExperiments.first
        let experiment = task.map { CompassExperiment(task: $0, imprint: source(for: $0, in: imprints)) }
        let outcome = task?.practiceOutcome
        let theme = dominantTheme(in: recentImprints)
        let headline = switch outcome {
        case .some(.helped): "Something worked."
        case .some(.mixed): "Something is worth adjusting."
        case .some(.notForMe): "You found something not worth carrying."
        case nil: theme.map { "\($0) kept coming back." } ?? "You put an idea into real life."
        }
        let experimentSource = experiment?.imprint
        let experimentSourceIsRecent = experimentSource.map { source in
            recentImprints.contains(where: { $0.id == source.id })
        } ?? false
        let experimentTheme = experimentSource?.themes.first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?.lowercased()
        let normalizedTheme = theme?.lowercased()
        let story: String
        if let task {
            if experimentSourceIsRecent, let normalizedTheme {
                story = "Your attention kept returning to \(normalizedTheme). You put that attention into real life when you tried “\(task.title).”"
            } else {
                let experimentStory = experimentSource != nil
                    ? "An older idea\(experimentTheme.map { " about \($0)" } ?? "") moved into real life when you tried “\(task.title).”"
                    : "In real life, you tried “\(task.title).”"
                let recentStory = if let normalizedTheme, normalizedTheme != experimentTheme {
                    " Your newer saves kept circling \(normalizedTheme)."
                } else {
                    ""
                }
                story = experimentStory + recentStory
            }
        } else if let normalizedTheme {
            story = "Your attention kept returning to \(normalizedTheme)."
        } else {
            story = "You gave something your attention this week."
        }
        let alreadyContinued = task.map { completed in
            life.tasks.contains { candidate in
                guard candidate.id != completed.id,
                      candidate.source == "practice",
                      candidate.status != .done,
                      candidate.status != .removed else { return false }
                if let sourceItemId = completed.sourceItemId { return candidate.sourceItemId == sourceItemId }
                return candidate.title == completed.title
            }
        } ?? false

        return WeeklySynthesis(
            headline: headline,
            story: story,
            reflection: task?.practiceReflection?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            theme: theme,
            experiment: experiment,
            outcome: outcome,
            canCarryForward: task != nil && (outcome == .helped || outcome == .mixed) && !alreadyContinued
        )
    }

    private static func source(for task: LifeTask, in imprints: [Imprint]) -> Imprint? {
        if let sourceItemId = task.sourceItemId,
           let source = imprints.first(where: { $0.id == sourceItemId }) { return source }
        return imprints.first { task.notes.contains($0.url.absoluteString) || task.notes.contains("“\($0.title)”.") }
    }

    private static func dominantTheme(in imprints: [Imprint]) -> String? {
        var counts: [String: (count: Int, first: Int)] = [:]
        var order = 0
        for imprint in imprints.sorted(by: { $0.savedAt > $1.savedAt }) {
            for rawTheme in imprint.themes {
                let theme = rawTheme.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !theme.isEmpty else { continue }
                let current = counts[theme]
                counts[theme] = ((current?.count ?? 0) + 1, current?.first ?? order)
                if current == nil { order += 1 }
            }
        }
        return counts.sorted { left, right in
            left.value.count == right.value.count ? left.value.first < right.value.first : left.value.count > right.value.count
        }.first?.key
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
