import Foundation

enum ReturnCueFinder {
    static func find(
        in imprints: [Imprint],
        cue: ReturnCue,
        reflections: [EvolutionReflection] = [],
        returnFeedback: [EvolutionReturnFeedback] = [],
        tasks: [LifeTask] = [],
        excluding: Set<UUID> = [],
        now: Date = .now
    ) -> Imprint? {
        let eligibility = ReturnEligibility(reflections: reflections, returnFeedback: returnFeedback, tasks: tasks, now: now)
        return imprints.filter { imprint in
            guard !excluding.contains(imprint.id), eligibility.allows(imprint), imprint.returnCue == cue else { return false }
            guard cue == .date else { return true }
            guard let returnAt = imprint.returnAt else { return false }
            return returnAt <= now
        }.sorted { left, right in
            if cue == .date { return (left.returnAt ?? .distantFuture) < (right.returnAt ?? .distantFuture) }
            if (left.reaction != nil) != (right.reaction != nil) { return left.reaction != nil }
            return left.savedAt > right.savedAt
        }.first
    }
}
