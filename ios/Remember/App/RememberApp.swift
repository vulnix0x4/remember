import SwiftUI

@main
struct RememberApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var store: AppStore

    init() {
        let repository = LiveImprintRepository(
            client: APIClient(baseURL: AppConfiguration.apiURL, credentials: AppConfiguration.apiCredentials),
            usesMockFallback: AppConfiguration.usesMockFallback
        )
        _store = State(initialValue: AppStore(repository: repository, selectedTab: AppConfiguration.initialTab))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .tint(RememberDesign.accent)
                .preferredColorScheme(.dark)
                .task { await store.bootstrap() }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await store.importSharedURLs() }
                }
        }
    }
}
