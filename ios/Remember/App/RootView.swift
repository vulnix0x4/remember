import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var planSection = AppConfiguration.initialPlanSection
    @State private var lifeSection = AppConfiguration.initialLifeSection
    @State private var librarySection = AppConfiguration.initialLibrarySection
    @State private var lastPrimaryTab = AppConfiguration.initialTab
    @State private var settingsIsPresented = false
    @State private var settingsLaunchIsPending = AppConfiguration.presentsSettingsOnLaunch

    var body: some View {
        @Bindable var store = store
        Group {
            if store.isCheckingAuthentication {
                AuthLoadingView()
            } else if store.isAuthenticated {
                TabView(selection: $store.selectedTab) {
                    ForEach(AppTab.primaryTabs, id: \.self) { tab in
                        Tab(tab.title, systemImage: tab.systemImage, value: tab) {
                            tabContent(for: tab)
                        }
                    }
                }
                .background {
                    TabBarIdentifierBridge(
                        identifiers: AppTab.primaryTabs.map(\.accessibilityIdentifier)
                    )
                }
                .toolbarBackground(RememberDesign.surface.opacity(0.96), for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
            } else {
                LoginView()
            }
        }
        .onChange(of: store.selectedTab, routeTabIntent)
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await store.refreshBrain()
                do { try await Task.sleep(for: .seconds(60)) } catch { return }
            }
        }
        .onChange(of: store.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated, settingsLaunchIsPending {
                settingsLaunchIsPending = false
                settingsIsPresented = true
            } else if !isAuthenticated {
                settingsIsPresented = false
            }
        }
        .sheet(isPresented: $store.captureIsPresented) { CaptureView() }
        .sheet(isPresented: $settingsIsPresented) { SettingsSheet() }
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
        case .plan, .tasks, .calendar, .goals:
            PlanContainerView(selection: $planSection)
        case .library, .evolution:
            LibraryContainerView(selection: $librarySection)
        case .ask: AskView()
        case .life, .health, .money, .files:
            LifeContainerView(selection: $lifeSection)
        case .settings: HomeView()
        }
    }

    private func routeTabIntent(_ previousTab: AppTab, _ tab: AppTab) {
        switch tab {
        case .home, .plan, .library, .ask, .life:
            lastPrimaryTab = tab
        case .tasks:
            planSection = .tasks
            store.selectedTab = .plan
        case .calendar:
            planSection = .calendar
            store.selectedTab = .plan
        case .goals:
            planSection = .goals
            store.selectedTab = .plan
        case .health:
            lifeSection = .health
            store.selectedTab = .life
        case .money:
            lifeSection = .money
            store.selectedTab = .life
        case .files:
            lifeSection = .files
            store.selectedTab = .life
        case .evolution:
            librarySection = .patterns
            store.selectedTab = .library
        case .settings:
            settingsIsPresented = true
            store.selectedTab = previousTab == .settings ? lastPrimaryTab : previousTab
        }
    }
}
