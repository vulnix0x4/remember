import Foundation

struct APIUserDTO: Decodable, Sendable {
    let id: String
    let mode: String
    let email: String?
}
