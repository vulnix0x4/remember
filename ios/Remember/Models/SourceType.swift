import Foundation

enum SourceType: String, Codable, Sendable {
    case youtube
    case web
    case note

    var label: String {
        switch self {
        case .youtube: "YouTube"
        case .web: "Web"
        case .note: "Thought"
        }
    }
}
