import Foundation

struct APIAskResponse: Decodable, Sendable {
    let threadId: String?
    let answer: String
    let citations: [APICitationDTO]
    let grounded: Bool
    let limitations: [String]
}
