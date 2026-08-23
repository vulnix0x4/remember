import Foundation

struct EvolutionTheme: Decodable, Identifiable, Hashable, Sendable {
    let name: String
    let count: Int
    let lastSeenAt: String?

    var id: String { name }
}
