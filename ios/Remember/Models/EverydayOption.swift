import Foundation

struct EverydayOption: Decodable, Sendable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let firstStep: String
    let durationMinutes: Int
    let facts: [String]
}
