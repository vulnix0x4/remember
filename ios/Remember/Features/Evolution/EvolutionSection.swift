import Foundation

enum EvolutionSection: String, CaseIterable, Identifiable {
    case compass = "Compass"
    case themes = "Threads"
    case principles = "Takeaways"
    case tensions = "Contrasts"
    case timeline = "History"

    var id: Self { self }
}
