import Foundation

enum ProcessingState: String, Codable, CaseIterable, Sendable {
    case ready
    case processing
    case partial
    case failed

    var label: String {
        switch self {
        case .ready: "Ready"
        case .processing: "Understanding"
        case .partial: "Partially understood"
        case .failed: "Needs attention"
        }
    }

    var symbol: String {
        switch self {
        case .ready: "checkmark.circle.fill"
        case .processing: "sparkles"
        case .partial: "circle.lefthalf.filled"
        case .failed: "exclamationmark.triangle.fill"
        }
    }
}
