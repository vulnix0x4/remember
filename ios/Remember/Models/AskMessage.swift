import Foundation

struct AskMessage: Identifiable, Hashable, Sendable {
    enum Role: Sendable { case user, assistant }
    let id: UUID
    let role: Role
    let text: String
    let citations: [Citation]
    let grounded: Bool?
    let limitations: [String]
}
