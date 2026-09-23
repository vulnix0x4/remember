import Foundation

struct EvolutionReflection: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let itemId: String
    let response: String
    let occurredAt: String
}
