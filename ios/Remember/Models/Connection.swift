import Foundation

struct Connection: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let itemID: UUID
    let type: ConnectionType
    let title: String
    let explanation: String
}
