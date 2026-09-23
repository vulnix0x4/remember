import Foundation

enum LibraryFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case thoughts = "Thoughts"
    case ready = "Analyzed"
    case processing = "Analyzing"
    case partial = "Some details"
    case failed = "Couldn’t analyze"
    var id: Self { self }

    func matches(_ imprint: Imprint) -> Bool {
        switch self {
        case .all: true
        case .thoughts: imprint.sourceType == .note
        case .ready: imprint.state == .ready
        case .processing: imprint.state == .processing
        case .partial: imprint.state == .partial
        case .failed: imprint.state == .failed
        }
    }
}
