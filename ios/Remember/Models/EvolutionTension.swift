import Foundation

struct EvolutionTension: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let fromItemId: String
    let toItemId: String
    let explanation: String
    let confidence: Double?
}
