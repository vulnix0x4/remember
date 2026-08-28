import Foundation

enum AppConfiguration {
    static var initialTab: AppTab {
        switch ProcessInfo.processInfo.environment["REMEMBER_INITIAL_TAB"] {
        case "library": .library
        case "ask": .ask
        case "evolution": .evolution
        case "settings": .settings
        default: .home
        }
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
