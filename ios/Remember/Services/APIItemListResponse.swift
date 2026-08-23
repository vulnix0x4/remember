import Foundation

struct APIItemListResponse: Decodable, Sendable {
    let items: [APIItemDTO]
    let nextCursor: String?
}
