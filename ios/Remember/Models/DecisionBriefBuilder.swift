import Foundation

enum DecisionBriefBuilder {
    static func build(decision: String, context: String, imprints: [Imprint]) -> DecisionBrief {
        let query = words(in: "\(decision) \(context)")
        var ranked: [(imprint: Imprint, index: Int, score: Int)] = []
        for (index, imprint) in imprints.enumerated() where imprint.state == .ready || imprint.state == .partial {
            ranked.append((imprint: imprint, index: index, score: score(imprint, query: query)))
        }
        ranked.sort { left, right in
            if left.score == right.score { return left.index < right.index }
            return left.score > right.score
        }
        let candidates = ranked.prefix(4).map { $0.imprint }
        let first = candidates.first
        let second = candidates.dropFirst().first
        return DecisionBrief(
            decision: decision,
            perspective: nonempty(first?.summary) ?? "Your library does not yet contain enough material to frame this decision.",
            whatMatters: nonempty(first?.candidatePrinciples.first)
                ?? nonempty(first?.personalHypotheses.first)
                ?? nonempty(first?.keyIdeas.first)
                ?? "Name what you want this decision to protect.",
            pullToward: nonempty(first?.keyIdeas.first) ?? nonempty(first?.essence) ?? "Your saves do not yet show a clear pull in this direction.",
            pullAgainst: nonempty(second?.uncertainties.first)
                ?? nonempty(first?.uncertainties.first)
                ?? nonempty(second?.keyIdeas.first)
                ?? "Your saves do not yet show what might be lost or made harder by this choice.",
            smallTest: nonempty(first?.experiments.first) ?? "Try the smallest reversible version of the choice before committing further.",
            nextQuestion: "What would I need to learn for this choice to become clearer?",
            citations: candidates.prefix(3).map { imprint in
                Citation(id: UUID(), itemID: imprint.id, title: imprint.title, seconds: nil, url: imprint.url, excerpt: imprint.essence)
            },
            grounded: !candidates.isEmpty,
            limitations: candidates.isEmpty
                ? ["No supporting saves were found for this decision yet."]
                : ["This preview uses the closest material already in your library."]
        )
    }

    private static func words(in value: String) -> Set<String> {
        Set(value.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count >= 3 })
    }

    private static func score(_ imprint: Imprint, query: Set<String>) -> Int {
        let text = ([imprint.title, imprint.essence, imprint.summary] + imprint.themes + imprint.keyIdeas).joined(separator: " ").lowercased()
        return query.reduce(0) { total, word in total + (text.contains(word) ? 2 : 0) }
    }

    private static func nonempty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}
