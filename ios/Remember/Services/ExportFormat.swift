import Foundation

enum ExportFormat: String, CaseIterable, Identifiable {
    case markdown
    case json
    var id: Self { self }
    var fileExtension: String { self == .json ? "json" : "md" }
}
