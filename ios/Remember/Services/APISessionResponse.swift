import Foundation

struct APISessionResponse: Decodable, Sendable {
    let user: APIUserDTO
}
