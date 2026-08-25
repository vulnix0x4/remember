import Foundation

enum LibraryFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case ready = "Ready"
    case processing = "Processing"
    case partial = "Partial"
    case failed = "Attention"
    var id: Self { self }

    func matches(_ state: ProcessingState) -> Bool {
        switch self {
        case .all: true
        case .ready: state == .ready
        case .processing: state == .processing
        case .partial: state == .partial
        case .failed: state == .failed
        }
    }
}
