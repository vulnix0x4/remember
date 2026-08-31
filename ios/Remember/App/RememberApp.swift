import SwiftUI

@main
struct RememberApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var store: AppStore

    init() {
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
                .tint(RememberDesign.accent)
                .preferredColorScheme(.dark)
                .task { await store.bootstrap() }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await store.refreshAfterActivation() }
                }
        }
    }
}
