import Foundation

enum LivingThreadBuilder {
    static func build(from imprints: [Imprint], reflections: [EvolutionReflection] = []) -> [LivingThread] {
        var savesByTheme: [String: [Imprint]] = [:]
        var namesByTheme: [String: String] = [:]
        let imprintsByID = Dictionary(uniqueKeysWithValues: imprints.map { ($0.id.uuidString.lowercased(), $0) })

        for imprint in imprints where imprint.state == .ready || imprint.state == .partial {
            var seen: Set<String> = []
            for theme in imprint.themes {
                let name = theme.trimmingCharacters(in: .whitespacesAndNewlines)
                let key = name.lowercased()
                guard !key.isEmpty, seen.insert(key).inserted else { continue }
                namesByTheme[key] = namesByTheme[key] ?? name
                savesByTheme[key, default: []].append(imprint)
            }
        }

        return savesByTheme.compactMap { key, saves in
            let sorted = saves.sorted { $0.savedAt < $1.savedAt }
            guard sorted.count >= 2, let earliest = sorted.first, let latest = sorted.last else { return nil }
            let saveIDs = Set(sorted.map { $0.id.uuidString.lowercased() })
            let turningPoints = reflections
                .filter { saveIDs.contains($0.itemId.lowercased()) }
                .sorted { $0.occurredAt < $1.occurredAt }
                .compactMap { reflection -> LivingThreadTurningPoint? in
                    guard
                        let imprint = imprintsByID[reflection.itemId.lowercased()],
                        let response = MemoryReflection(rawValue: reflection.response)
                    else { return nil }
                    return LivingThreadTurningPoint(
                        id: reflection.id,
                        imprint: imprint,
                        response: response,
                        occurredAt: reflection.occurredAt
                    )
                }
            let latestResponse = turningPoints.last?.response
            return LivingThread(
                id: key,
                name: namesByTheme[key] ?? key.capitalized,
                saves: sorted,
                earliest: earliest,
                latest: latest,
                turningPoints: turningPoints,
                pulse: pulse(for: latestResponse),
                question: question(for: namesByTheme[key] ?? key.capitalized, response: latestResponse)
            )
        }
        .sorted {
            if $0.saves.count != $1.saves.count { return $0.saves.count > $1.saves.count }
            if $0.latest.savedAt != $1.latest.savedAt { return $0.latest.savedAt > $1.latest.savedAt }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    private static func pulse(for response: MemoryReflection?) -> LivingThreadPulse {
        return switch response {
        case .stillTrue:
            LivingThreadPulse(kind: .held, label: "Still part of your compass", detail: "You have come back to this and chosen to keep it.")
        case .changedMind:
            LivingThreadPulse(kind: .shifting, label: "Your thinking is changing", detail: "This thread contains a real change of mind, not just another related save.")
        case .notSure:
            LivingThreadPulse(kind: .open, label: "Still unresolved", detail: "You left this open. Remember can help you stay with the question without forcing an answer.")
        case .noLongerRelevant:
            LivingThreadPulse(kind: .released, label: "You are carrying this differently", detail: "Part of this thread no longer belongs, which is also part of how your thinking changed.")
        case nil:
            LivingThreadPulse(kind: .unread, label: "Ready for your take", detail: "The pattern is here. The next useful signal is what it means to you now.")
        }
    }

    private static func question(for name: String, response: MemoryReflection?) -> String {
        let subject = name.lowercased()
        return switch response {
        case .stillTrue:
            "What makes my thinking about \(subject) still feel true now, and where does it matter in my life?"
        case .changedMind:
            "What changed my mind about \(subject), and what do I seem to believe instead?"
        case .notSure:
            "What would help me know what I think about \(subject), without forcing an answer too early?"
        case .noLongerRelevant:
            "What am I carrying now instead of the part of \(subject) I let go?"
        case nil:
            "How has my thinking about \(subject) changed across these saves? What still feels unresolved?"
        }
    }
}
