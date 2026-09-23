import Foundation

enum ProcessingState: String, Codable, CaseIterable, Sendable {
    case ready
    case processing
    case partial
    case failed

    var label: String {
        switch self {
        case .ready: "Saved"
        case .processing: "Analyzing"
        case .partial: "Some details available"
        case .failed: "Couldn’t analyze"
        }
    }

    var symbol: String {
        switch self {
        case .ready: "checkmark.circle.fill"
        case .processing: "clock"
        case .partial: "circle.lefthalf.filled"
        case .failed: "exclamationmark.circle.fill"
        }
    }
}
