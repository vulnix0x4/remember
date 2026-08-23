import Foundation

struct APIAuthRequest: Encodable, Sendable {
    let email: String
    let password: String
}
