import Foundation

struct EvolutionPrinciple: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let itemId: String
    let text: String
    let rationale: String?
    var status: String?
    let createdAt: String?
}
