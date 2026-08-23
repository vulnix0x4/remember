import Foundation

enum SourceType: String, Codable, Sendable {
    case youtube
    case web

    var label: String { self == .youtube ? "YouTube" : "Web" }
}
