import Foundation

enum AppTab: Hashable, CaseIterable {
    case home
    case library
    case ask
    case tasks
    case calendar
    case health
    case goals
    case money
    case files
    case evolution
    case settings

    var title: String {
        switch self {
        case .home: "Today"
        case .tasks: "Tasks"
        case .calendar: "Calendar"
        case .health: "Health"
        case .goals: "Goals"
        case .money: "Money"
        case .files: "Files"
        case .library: "Library"
        case .ask: "Ask"
        case .evolution: "Evolution"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .tasks: "checklist"
        case .calendar: "calendar"
        case .health: "heart.text.square"
        case .goals: "scope"
        case .money: "wallet.bifold"
        case .files: "folder"
        case .library: "books.vertical"
        case .ask: "bubble.left.and.text.bubble.right"
        case .evolution: "point.3.connected.trianglepath.dotted"
        case .settings: "gearshape"
        }
    }
}
