import SwiftUI

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @State private var dismissedContextualIDs: Set<UUID> = []
    @State private var completedReturn: TodayReturn?
    @State private var completedReturnIDs: Set<UUID> = []
    @State private var returnPresentationID = UUID()
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    NowCard()
                    upNext
                    DailyBasicsStrip()
                    ideaForToday
                }
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.bottom, RememberDesign.spacingLarge)
            }
            .scrollDismissesKeyboard(.immediately)
            .refreshable { await store.loadLife() }
            .safeAreaInset(edge: .top, spacing: 0) {
                RememberHeader("Today") {
                    JevStatusLine()
                }
            }
            .background(RememberDesign.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .rememberBottomDock {
                AddBar(placeholder: "Add a task…", parsesTasks: true, accessibilityIdentifier: "remember.task.quickAdd") {
                    await store.quickAddTask($0)
                }
            }
            .sheet(item: $openTask) { TaskEditorSheet(task: $0) }
            .onDisappear {
                returnPresentationID = UUID()
                completedReturn = nil
            }
        }
    }

    @State private var openTask: LifeTask?

    private var upNextTasks: [LifeTask] {
        let current = store.lifeSnapshot.activeTask?.id ?? store.suggestedLifeTask?.id
        return Array(store.queuedLifeTasks.filter { $0.id != current }.prefix(3))
    }

    @ViewBuilder
    private var upNext: some View {
        let tasks = upNextTasks
        if !tasks.isEmpty {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Up next")
                ForEach(tasks) { task in
                    TaskRow(task: task) { openTask = task }
                }
                if store.queuedLifeTasks.count > tasks.count + 1 {
                    Button("See all in Plan") { store.selectedTab = .tasks }
                        .buttonStyle(.rememberQuiet)
                }
            }
        }
    }

    @ViewBuilder
    private var ideaForToday: some View {
        if let featuredReturn {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "One idea for today")
                returnCard(featuredReturn)
                    .id(featuredReturn.imprint.id)
                if completedReturn != nil {
                    Button("Done with this idea", systemImage: "checkmark") {
                        returnPresentationID = UUID()
                        completedReturn = nil
                    }
                    .buttonStyle(.rememberQuiet)
                    .accessibilityIdentifier("remember.today.return.done")
                }
            }
        }
    }

    @ViewBuilder
    private func returnCard(_ selection: TodayReturn) -> some View {
        let presentationID = returnPresentationID
        switch selection {
        case let .intentional(imprint, cue):
            IntentionalReturnCard(imprint: imprint, cue: cue) { complete(selection, presentationID: presentationID) }
        case let .contextual(match):
            ContextualReturnCard(match: match, onNotToday: {
                dismissedContextualIDs.insert(match.imprint.id)
                guard returnPresentationID == presentationID else { return }
                returnPresentationID = UUID()
                completedReturn = nil
            }, onReflectionSaved: { complete(selection, presentationID: presentationID) })
        case let .resurfaced(imprint):
            ResurfacedCard(imprint: imprint) { complete(selection, presentationID: presentationID) }
        }
    }

    private func complete(_ selection: TodayReturn, presentationID: UUID) {
        guard returnPresentationID == presentationID else { return }
        // Keep the returned idea and its acknowledgement together until the
        // person finishes, even when their response makes it ineligible.
        completedReturn = selection
        completedReturnIDs.insert(selection.imprint.id)
    }

    private var featuredReturn: TodayReturn? {
        if let completedReturn, store.imprint(withID: completedReturn.imprint.id) != nil { return completedReturn }
        if let dueReturn { return .intentional(dueReturn, .date) }
        if let contextualReturn { return .contextual(contextualReturn) }
        if let resurfaced = store.resurfaced, !completedReturnIDs.contains(resurfaced.id) {
            return .resurfaced(resurfaced)
        }
        return nil
    }

    private var contextualReturn: ContextualReturn? {
        ContextualReturnFinder.find(
            in: store.imprints,
            snapshot: store.lifeSnapshot,
            reflections: store.evolutionOverview.reflections,
            returnFeedback: store.evolutionOverview.returnFeedback,
            recentQuestion: store.lastAskedQuestion ?? store.evolutionOverview.recentQuestion,
            excluding: dismissedContextualIDs.union(completedReturnIDs)
        )
    }

    private var dueReturn: Imprint? {
        findReturn(for: .date)
    }

    private func findReturn(for cue: ReturnCue) -> Imprint? {
        ReturnCueFinder.find(
            in: store.imprints,
            cue: cue,
            reflections: store.evolutionOverview.reflections,
            returnFeedback: store.evolutionOverview.returnFeedback,
            tasks: store.lifeSnapshot.tasks,
            excluding: completedReturnIDs
        )
    }

}
