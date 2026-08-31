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
                    ForEach(AppTab.allCases, id: \.self) { tab in
                        tabContent(for: tab)
                            .tabItem { Label(tab.title, systemImage: tab.systemImage) }
                            .tag(tab)
                    }
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

    @ViewBuilder
    private func tabContent(for tab: AppTab) -> some View {
        switch tab {
        case .home: HomeView()
        case .tasks: LifeTasksView()
        case .calendar: LifeCalendarView()
        case .health: LifeHealthView()
        case .goals: LifeGoalsView()
        case .money: LifeMoneyView()
        case .files: LifeFilesView()
        case .library: LibraryView()
        case .ask: AskView()
        case .evolution: EvolutionView()
        case .settings: SettingsView()
        }
    }
}
