import Foundation

struct Citation: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let itemID: UUID
    let title: String
    let seconds: Int?
    let url: URL
    let excerpt: String
}
