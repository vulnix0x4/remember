import Foundation

struct APIItemDetailResponse: Decodable, Sendable {
    struct ConnectionDTO: Decodable, Sendable {
        let id: String
        let fromItemId: String
        let toItemId: String
        let type: String
        let explanation: String
        let relatedTitle: String?
    }

    struct PrincipleDTO: Decodable, Sendable {
        let id: String
        let status: String
    }

    let item: APIItemDTO
    let connections: [ConnectionDTO]
    let principles: [PrincipleDTO]
}
