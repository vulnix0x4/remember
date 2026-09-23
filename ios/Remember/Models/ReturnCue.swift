import Foundation

enum ReturnCue: String, Codable, CaseIterable, Identifiable, Sendable {
    case stuck
    case focus
    case decision
    case date

    var id: String { rawValue }

    var label: String {
        switch self {
        case .stuck: "When I’m stuck"
        case .focus: "Before focused work"
        case .decision: "When I’m deciding"
        case .date: "On a day I choose"
        }
    }

    var shortLabel: String {
        switch self {
        case .stuck: "Get unstuck"
        case .focus: "Focus"
        case .decision: "Decide"
        case .date: "Choose a day"
        }
    }

    var systemImage: String {
        switch self {
        case .stuck: "arrow.trianglehead.branch"
        case .focus: "scope"
        case .decision: "signpost.right"
        case .date: "calendar"
        }
    }

    var reason: String {
        switch self {
        case .stuck: "You kept this for a moment when you felt stuck."
        case .focus: "You kept this for the start of focused work."
        case .decision: "You kept this for a decision that needed perspective."
        case .date: "You chose today for this idea to come back."
        }
    }

    func question(for imprint: Imprint) -> String {
        let moment = switch self {
        case .stuck: "get unstuck"
        case .focus: "focus on what matters"
        case .decision: "think through a decision"
        case .date: "use this today"
        }
        return "What from “\(imprint.title)” could help me \(moment) right now?"
    }
}
