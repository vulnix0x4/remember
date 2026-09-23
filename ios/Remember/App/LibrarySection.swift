import Foundation

enum LibrarySection: String, CaseIterable, Identifiable {
    case saved = "Saved"
    case patterns = "Patterns"

    var id: Self { self }
}
