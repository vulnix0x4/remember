import Foundation

enum LifeSection: String, CaseIterable, Identifiable {
    case health = "Health"
    case money = "Money"
    case files = "Files"

    var id: Self { self }
}
