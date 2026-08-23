import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        @Bindable var store = store
        Group {
            if store.isCheckingAuthentication {
                AuthLoadingView()
            } else if store.isAuthenticated {
                TabView(selection: $store.selectedTab) {
                    Tab("Today", systemImage: "house", value: .home) { HomeView() }
                    Tab("Library", systemImage: "books.vertical", value: .library) { LibraryView() }
                    Tab("Ask", systemImage: "bubble.left.and.text.bubble.right", value: .ask) { AskView() }
                    Tab("Evolution", systemImage: "point.3.connected.trianglepath.dotted", value: .evolution) { EvolutionView() }
                    Tab("Settings", systemImage: "gearshape", value: .settings) { SettingsView() }
                }
                .toolbarBackground(RememberDesign.surface.opacity(0.96), for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
            } else {
                LoginView()
            }
        }
        .sheet(isPresented: $store.captureIsPresented) { CaptureView() }
        .alert("Something went wrong", isPresented: $store.errorIsPresented) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Please try again.")
        }
    }
}
