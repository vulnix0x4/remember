import Foundation

struct EverydayDecision: Decodable, Sendable {
    let provider: String
    let model: String
    let evaluatedAt: Date
    let expiresAt: Date
    let confidence: Double
    let disposition: String
    let availableMinutes: Int
    let focusStarted: Bool
    let selected: EverydayOption
    let alternatives: [EverydayOption]
}
