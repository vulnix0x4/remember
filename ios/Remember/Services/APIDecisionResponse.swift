import Foundation

struct APIDecisionResponse: Decodable, Sendable {
    let decision: String
    let perspective: String
    let whatMatters: String
    let pullToward: String
    let pullAgainst: String
    let smallTest: String
    let nextQuestion: String
    let citations: [APICitationDTO]
    let grounded: Bool
    let limitations: [String]
}
