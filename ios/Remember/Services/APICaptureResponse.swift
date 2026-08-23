import Foundation

struct APICaptureResponse: Decodable, Sendable {
    let item: APIItemDTO
    let deduplicated: Bool
    let duplicate: Bool
}
