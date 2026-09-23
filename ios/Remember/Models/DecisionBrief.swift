import Foundation

struct DecisionBrief: Hashable, Sendable {
    let decision: String
    let perspective: String
    let whatMatters: String
    let pullToward: String
    let pullAgainst: String
    let smallTest: String
    let nextQuestion: String
    let citations: [Citation]
    let grounded: Bool
    let limitations: [String]
}
