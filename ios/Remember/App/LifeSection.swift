import Foundation

enum LifeSection: String, CaseIterable, Identifiable {
    case health = "Health"
    case sleep = "Sleep"
    case money = "Money"
    case files = "Files"

    var id: Self { self }
}
