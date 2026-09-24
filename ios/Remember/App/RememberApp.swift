import SwiftUI

@main
struct RememberApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var store: AppStore
    @State private var focusTimer = FocusTimer()
    @State private var focusShield = FocusShield()
    @State private var nudges = Nudges()

    init() {
        #if DEBUG
        // UI tests start from a clean device: no routine in progress, no running focus timer.
        if ProcessInfo.processInfo.environment["REMEMBER_RESET_LOCAL_STATE"] == "1" {
            let defaults = UserDefaults.standard
            for key in defaults.dictionaryRepresentation().keys
            where key.hasPrefix("remember.routine.") || key.hasPrefix("remember.focus.") || key.hasPrefix("remember.setup.") {
                defaults.removeObject(forKey: key)
            }
        }
        #endif
        let client = APIClient(baseURL: AppConfiguration.apiURL, credentials: AppConfiguration.apiCredentials)
        let repository = LiveImprintRepository(
            client: client,
            usesMockFallback: AppConfiguration.usesMockFallback
        )
        let lifeRepository = LiveLifeOSRepository(client: client, usesMockFallback: AppConfiguration.usesMockFallback)
        _store = State(initialValue: AppStore(repository: repository, lifeRepository: lifeRepository, selectedTab: AppConfiguration.initialTab))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(focusTimer)
                .environment(focusShield)
                .environment(nudges)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.text)
                .preferredColorScheme(.dark)
                .task { await store.bootstrap() }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await store.refreshAfterActivation() }
                }
        }
    }
}
