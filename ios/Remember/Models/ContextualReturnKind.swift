import Foundation

enum ContextualReturnKind: String, Hashable, Sendable {
    case task
    case goal
    case event
    case question

    var contextLabel: String {
        switch self {
        case .task: "current task"
        case .goal: "active goal"
        case .event: "next event"
        case .question: "recent question"
        }
    }
}
