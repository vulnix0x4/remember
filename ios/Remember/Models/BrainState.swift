import Foundation

struct BrainState: Codable, Sendable {
    let settings: BrainSettings
    let status: String
    let message: String
    let model: String?
    let evaluatedAt: Date?
    let nextCheckAt: Date?
    let plan: [BrainBlock]
    let contextUsed: [String]
    let unscheduledCount: Int
}
