import Foundation

struct ReturnEligibility {
    let reflections: [UUID: EvolutionReflection]
    let feedback: [UUID: EvolutionReturnFeedback]
    let practiceResults: [UUID: LifeTask]
    private let now: Date

    init(
        reflections: [EvolutionReflection] = [],
        returnFeedback: [EvolutionReturnFeedback] = [],
        tasks: [LifeTask] = [],
        now: Date = .now
    ) {
        self.now = now
        self.reflections = Self.latest(reflections, itemID: \.itemId, occurredAt: \.occurredAt)
        feedback = Self.latest(returnFeedback, itemID: \.itemId, occurredAt: \.occurredAt)
        var results: [UUID: LifeTask] = [:]
        for task in tasks
            .filter({ $0.source == "practice" && $0.practiceOutcome != nil })
            .sorted(by: { ($0.reflectedAt ?? $0.updatedAt) > ($1.reflectedAt ?? $1.updatedAt) }) {
            guard let itemID = task.sourceItemId, results[itemID] == nil else { continue }
            results[itemID] = task
        }
        practiceResults = results
    }

    func allows(_ imprint: Imprint) -> Bool {
        guard imprint.state == .ready || imprint.state == .partial else { return false }
        let reflection = reflections[imprint.id]
        guard reflection?.response != MemoryReflection.noLongerRelevant.rawValue,
              practiceResults[imprint.id]?.practiceOutcome != .notForMe else { return false }

        if let response = feedback[imprint.id], response.response == "not_today",
           let respondedAt = Self.date(from: response.occurredAt),
           respondedAt >= now.addingTimeInterval(-7 * 86_400) {
            return false
        }

        // A check-in fulfills the chosen return. Moving the date beyond that
        // response explicitly makes the source available for its new return.
        if imprint.returnCue == .date, let returnAt = imprint.returnAt,
           let reflectedAt = reflection.flatMap({ Self.date(from: $0.occurredAt) }),
           reflectedAt >= returnAt {
            return false
        }
        return true
    }

    private static func latest<Value>(
        _ values: [Value],
        itemID: KeyPath<Value, String>,
        occurredAt: KeyPath<Value, String>
    ) -> [UUID: Value] {
        var latest: [UUID: Value] = [:]
        for value in values {
            guard let id = UUID(uuidString: value[keyPath: itemID]) else { continue }
            if let previous = latest[id],
               (date(from: previous[keyPath: occurredAt]) ?? .distantPast)
                >= (date(from: value[keyPath: occurredAt]) ?? .distantPast) {
                continue
            }
            latest[id] = value
        }
        return latest
    }

    private static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
