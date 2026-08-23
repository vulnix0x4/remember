import Foundation

enum EvolutionSection: String, CaseIterable, Identifiable {
    case themes = "Themes"
    case principles = "Principles"
    case tensions = "Tensions"
    case timeline = "Timeline"
    var id: Self { self }
}
