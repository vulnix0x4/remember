import Foundation

struct AskAnswer: Sendable {
    let text: String
    let citations: [Citation]
    let grounded: Bool
    let limitations: [String]
}
