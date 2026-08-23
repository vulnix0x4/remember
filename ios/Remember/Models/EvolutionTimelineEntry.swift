import Foundation

struct EvolutionTimelineEntry: Decodable, Identifiable, Hashable, Sendable {
    let month: String
    let theme: String
    let count: Int

    var id: String { "\(month)-\(theme)" }
}
