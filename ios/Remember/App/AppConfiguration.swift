import Foundation

enum AppConfiguration {
    private static var initialRoute: String? {
        ProcessInfo.processInfo.environment["REMEMBER_INITIAL_TAB"]?.lowercased()
    }

    static var initialTab: AppTab {
        switch initialRoute {
        case "tasks", "calendar", "goals", "plan": .plan
        case "health", "money", "files", "life": .life
        case "library", "evolution", "patterns": .library
        case "ask": .ask
        default: .home
        }
    }

    static var initialPlanSection: PlanSection {
        switch initialRoute {
        case "calendar": .calendar
        case "goals": .goals
        default: .tasks
        }
    }

    static var initialLifeSection: LifeSection {
        switch initialRoute {
        case "money": .money
        case "files": .files
        default: .health
        }
    }

    static var initialLibrarySection: LibrarySection {
        switch initialRoute {
        case "evolution", "patterns": .patterns
        default: .saved
        }
    }

    static var presentsSettingsOnLaunch: Bool {
        initialRoute == "settings"
    }

    static var apiURL: URL {
        if let value = ProcessInfo.processInfo.environment["REMEMBER_API_URL"],
           let configuredURL = URL(string: value) {
            return configuredURL
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: "RememberAPIURL") as? String,
           let configuredURL = URL(string: value) {
            return configuredURL
        }
        fatalError("Set REMEMBER_API_URL in the environment or build configuration.")
    }

    static var apiCredentials: APICredentials {
        let environmentToken = ProcessInfo.processInfo.environment["REMEMBER_API_TOKEN"]
        return APICredentials(bearerToken: environmentToken ?? KeychainTokenStore.load())
    }

    static var usesMockFallback: Bool {
        #if DEBUG
        if let value = ProcessInfo.processInfo.environment["REMEMBER_MOCK_FALLBACK"] {
            return value == "1" || value.lowercased() == "true"
        }
        #endif
        return false
    }
}
