import Foundation

enum AppTab: Hashable {
    // The only destinations rendered in the system tab bar.
    case home
    case plan
    case library
    case ask
    case life

    // Compatibility routes used by existing feature buttons and launch configuration.
    // RootView translates these into a primary tab and its selected section.
    case tasks
    case calendar
    case goals
    case health
    case money
    case files
    case evolution
    case settings

    static let primaryTabs: [AppTab] = [.home, .plan, .library, .ask, .life]

    var accessibilityIdentifier: String {
        switch self {
        case .home: "remember.tab.today"
        case .plan, .tasks, .calendar, .goals: "remember.tab.plan"
        case .library, .evolution: "remember.tab.library"
        case .ask: "remember.tab.ask"
        case .life, .health, .money, .files: "remember.tab.life"
        case .settings: "remember.global.settings"
        }
    }

    var title: String {
        switch self {
        case .home: "Today"
        case .plan: "Plan"
        case .library: "Library"
        case .ask: "Ask"
        case .life: "Life"
        case .tasks: "Tasks"
        case .calendar: "Calendar"
        case .goals: "Goals"
        case .health: "Health"
        case .money: "Money"
        case .files: "Files"
        case .evolution: "Patterns"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .plan: "checklist"
        case .library: "books.vertical"
        case .ask: "bubble.left.and.text.bubble.right"
        case .life: "square.grid.2x2"
        case .tasks: "checklist"
        case .calendar: "calendar"
        case .goals: "scope"
        case .health: "heart.text.square"
        case .money: "wallet.bifold"
        case .files: "folder"
        case .evolution: "point.3.connected.trianglepath.dotted"
        case .settings: "gearshape"
        }
    }
}
