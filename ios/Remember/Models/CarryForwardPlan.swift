import Foundation

enum CarryForwardPlan {
    static func taskTitle(for experiment: String) -> String {
        let clean = experiment.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".!?"))
        guard clean.count > 86 else { return clean }
        let candidate = String(clean.prefix(83))
        let boundary = candidate.lastIndex(of: " ")
        let shortened = boundary.map { String(candidate[..<$0]) } ?? candidate
        return shortened.trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    static func area(for imprint: Imprint) -> LifeArea {
        area(for: (imprint.themes + [imprint.title, imprint.essence]).joined(separator: " "))
    }

    static func area(for value: String) -> LifeArea {
        let material = value.lowercased()
        let signals: [(LifeArea, [String])] = [
            (.health, ["health", "sleep", "recovery", "fitness", "body", "exercise", "nutrition"]),
            (.work, ["work", "career", "creative", "building", "business", "craft", "focus"]),
            (.relationships, ["relationship", "relationships", "love", "friendship", "family", "grief"]),
            (.money, ["money", "finance", "financial", "spending", "saving", "wealth"]),
            (.environment, ["environment", "home", "space", "place"]),
            (.growth, ["growth", "learning", "identity", "confidence", "mindset", "attention"]),
        ]
        let tokens = Set(material.split { !$0.isLetter && !$0.isNumber }.map(String.init))
        return signals.first { _, words in words.contains { tokens.contains($0) } }?.0 ?? .direction
    }

    static func notes(for imprint: Imprint) -> String {
        if imprint.sourceType == .note {
            return "Carried forward from your thought: “\(imprint.title)”."
        }
        return "Carried forward from “\(imprint.title)”.\n\(imprint.url.absoluteString)"
    }
}
