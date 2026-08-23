import Foundation

struct APICitationDTO: Decodable, Sendable {
    let itemId: String
    let title: String
    let url: String
    let timestampSeconds: Int?
    let excerpt: String
}
