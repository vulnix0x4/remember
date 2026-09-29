import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(Nudges.self) private var nudges
    @Environment(SleepGuard.self) private var sleepGuard
    @Environment(\.scenePhase) private var scenePhase
    @State private var planSection = AppConfiguration.initialPlanSection
    @State private var lifeSection = AppConfiguration.initialLifeSection
    @State private var librarySection = AppConfiguration.initialLibrarySection
    @State private var lastPrimaryTab = AppConfiguration.initialTab
    @State private var settingsIsPresented = false
    @State private var settingsLaunchIsPending = AppConfiguration.presentsSettingsOnLaunch
    @State private var captureLaunchIsPending = AppConfiguration.presentsCaptureOnLaunch
    /// Ticks every 20 seconds so the phone-free screen starts and ends on time.
    @State private var clock = Date.now

    var body: some View {
        @Bindable var store = store
        // `clock` ticks so the night's phases change on time; `.now` so a tap takes effect at once.
        let phoneFree = store.isAuthenticated ? sleepGuard.phoneFree(at: max(clock, .now)) : nil
        Group {
            if store.isCheckingAuthentication {
                AuthLoadingView()
            } else if store.isAuthenticated, let phoneFree {
                // Phone-free: one calm screen instead of the app, from wind-down through the first part of the morning.
                PhoneFreeView(night: phoneFree.session, phase: phoneFree.phase, now: max(clock, .now))
                    .transition(.opacity)
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
                .toolbarBackground(RememberDesign.canvas, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.4), value: phoneFree?.phase)
        .task {
            while !Task.isCancelled {
                clock = .now
                do { try await Task.sleep(for: .seconds(20)) } catch { return }
            }
        }
        .onChange(of: store.brain?.settings.sleep, initial: true) { _, sleep in
            if let sleep { sleepGuard.update(sleep) }
            scheduleSleepNudges()
        }
        .onChange(of: nudges.isEnabled) { scheduleSleepNudges() }
        .onChange(of: store.lifeLoadCount) { scheduleSleepNudges() }
        .onChange(of: scenePhase) { _, phase in
            // Step-plan times move every few days; keep the lock and nudges in step whenever Remember opens.
            guard phase == .active else { return }
            clock = .now
            sleepGuard.syncLock()
            scheduleSleepNudges()
            // Mornings: bring in last night from Apple Health, so the check-in only asks how it felt.
            if store.isAuthenticated, store.sleep.enabled, (store.lastHealthSync ?? .distantPast) < .now.addingTimeInterval(-3600) {
                Task { await store.syncSleepQuietly(await HealthSyncService().readSleepQuietly()) }
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
            } else if isAuthenticated, captureLaunchIsPending {
                captureLaunchIsPending = false
                store.captureIsPresented = true
            } else if !isAuthenticated {
                settingsIsPresented = false
            }
        }
        .sheet(isPresented: $store.captureIsPresented) { CaptureView() }
        .fullScreenCover(isPresented: $store.setupIsPresented) { SetupFlowView() }
        .fullScreenCover(item: $store.lockInTask) { LockInView(task: $0) }
        .onChange(of: nextPlannedBlock?.taskId) {
            // One gentle nudge for whatever Jev planned next; replaced whenever the plan changes.
            nudges.cancelNextPlanned()
            if let block = nextPlannedBlock, store.lifeSnapshot.activeTask?.id != block.taskId {
                nudges.nextPlanned(title: block.title, at: block.startAt)
            }
        }
        .onChange(of: store.lifeLoadCount) {
            let firstRun = !SetupProgress.isComplete && store.lifeSnapshot.allCommitments.isEmpty
            if AppConfiguration.offersSetup, store.isAuthenticated, firstRun || AppConfiguration.forcesSetup,
               !store.setupIsPresented, store.lifeLoadCount == 1 || firstRun {
                store.setupIsPresented = true
            }
        }
        .sheet(isPresented: $settingsIsPresented) { SettingsSheet() }
        .alert("Something went wrong", isPresented: $store.errorIsPresented) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Please try again.")
        }
    }

    /// "Last call for caffeine", 8 hours before the usual bedtime, once Remember knows it.
    private func scheduleSleepNudges() {
        let sleep = sleepGuard.settings
        let nights = SleepInsights.lastWeek(SleepInsights.nights(from: store.lifeSnapshot.health), today: MorningFlow.dayKey(.now))
        let week = SleepInsights.week(nights)
        guard sleep.enabled, sleep.caffeineReminder, week.nights >= SleepMath.minNights, let bedtime = week.usualBedtime else {
            nudges.sleepReminders(caffeine: nil)
            return
        }
        let clock = SleepMath.minutes(SleepMath.time(bedtime + 18 * 60 - 8 * 60))
        nudges.sleepReminders(caffeine: DateComponents(hour: clock / 60, minute: clock % 60))
    }

    private var nextPlannedBlock: BrainBlock? {
        guard store.brain?.settings.enabled == true else { return nil }
        return store.brain?.plan.filter { $0.startAt > .now }.min { $0.startAt < $1.startAt }
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
