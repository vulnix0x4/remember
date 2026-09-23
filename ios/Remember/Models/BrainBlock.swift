import Foundation

struct BrainBlock: Codable, Sendable, Identifiable {
    let taskId: UUID
    let title: String
    let firstStep: String
    let startAt: Date
    let endAt: Date
    let confidence: Double
    let reason: String
    var id: UUID { taskId }
}
