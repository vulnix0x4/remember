import Foundation

struct EvolutionOverview: Decodable, Sendable {
    let themes: [EvolutionTheme]
    let principles: [EvolutionPrinciple]
    let tensions: [EvolutionTension]
    let timeline: [EvolutionTimelineEntry]

    static let empty = EvolutionOverview(themes: [], principles: [], tensions: [], timeline: [])

    var isEmpty: Bool {
        themes.isEmpty && principles.isEmpty && tensions.isEmpty && timeline.isEmpty
    }
}
