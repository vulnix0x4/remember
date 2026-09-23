import Foundation

enum PersonalCompassBuilder {
    static func build(
        overview: EvolutionOverview,
        life: LifeSnapshot,
        imprints: [Imprint]
    ) -> PersonalCompass {
        let experiments = life.tasks
            .filter { $0.source == "practice" && $0.status != .removed }
            .sorted { ($0.completedAt ?? $0.updatedAt) > ($1.completedAt ?? $1.updatedAt) }
            .map { task in CompassExperiment(task: task, imprint: source(for: task, in: imprints)) }
        let imprintsByID = Dictionary(uniqueKeysWithValues: imprints.map { ($0.id.uuidString.lowercased(), $0) })
        let completedExperiments = experiments.filter { $0.task.status == .done }
        var seenGuidanceSources = Set<String>()
        var guidance: [CompassGuidance] = []
        for experiment in completedExperiments {
            guard let outcome = experiment.task.practiceOutcome else { continue }
            let sourceID = (experiment.imprint?.id ?? experiment.task.sourceItemId)?.uuidString.lowercased()
                ?? experiment.task.id.uuidString.lowercased()
            guard seenGuidanceSources.insert(sourceID).inserted else { continue }
            let principle = overview.principles.first { $0.itemId.lowercased() == sourceID }
            let kind: CompassGuidanceKind = switch outcome {
            case .helped: .keep
            case .mixed: .adjust
            case .notForMe: .release
            }
            guidance.append(CompassGuidance(kind: kind, experiment: experiment, principle: principle))
            if guidance.count == 3 { break }
        }
        let changes = overview.reflections
            .filter { $0.response != "still_true" }
            .map { reflection in
                CompassReflection(
                    reflection: reflection,
                    imprint: imprintsByID[reflection.itemId.lowercased()],
                    statement: statement(for: reflection.response)
                )
            }

        return PersonalCompass(
            guidance: guidance,
            truths: overview.principles.filter { $0.status == "active" },
            suggestions: Array(overview.principles.filter { $0.status == nil || $0.status == "candidate" }.prefix(3)),
            activeExperiments: experiments.filter { $0.task.status != .done },
            completedExperiments: completedExperiments,
            changes: changes,
            tension: overview.tensions.first
        )
    }

    private static func source(for task: LifeTask, in imprints: [Imprint]) -> Imprint? {
        if let sourceItemId = task.sourceItemId,
           let source = imprints.first(where: { $0.id == sourceItemId }) { return source }
        return imprints.first { imprint in
            task.notes.contains(imprint.url.absoluteString) || task.notes.contains("“\(imprint.title)”")
        }
    }

    private static func statement(for response: String) -> String {
        switch response {
        case "changed_mind": "You said this no longer feels the same."
        case "no_longer_relevant": "You decided this no longer belongs in your life now."
        case "not_sure": "You are leaving this open instead of forcing an answer."
        default: "You came back to this and confirmed it still feels true."
        }
    }
}
