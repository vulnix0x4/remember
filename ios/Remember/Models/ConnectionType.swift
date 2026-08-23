import Foundation

enum ConnectionType: String, Codable, Sendable {
    case relatedTo = "related_to"
    case supports
    case contradicts
    case extends
    case sameTheme = "same_theme"
    case changedInto = "changed_into"

    var label: String {
        switch self {
        case .relatedTo: "Related to"
        case .supports: "Supports"
        case .contradicts: "In tension with"
        case .extends: "Extends"
        case .sameTheme: "Shares a theme"
        case .changedInto: "Changed into"
        }
    }
}
