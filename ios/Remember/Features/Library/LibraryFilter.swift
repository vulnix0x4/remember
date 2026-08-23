import Foundation

enum LibraryFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case ready = "Ready"
    case processing = "Processing"
    case partial = "Partial"
    case failed = "Attention"
    var id: Self { self }
}
