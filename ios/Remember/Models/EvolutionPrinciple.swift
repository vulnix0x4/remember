import Foundation

struct EvolutionPrinciple: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let itemId: String
    let text: String
    let rationale: String?
    let status: String?
    let createdAt: String?
}
