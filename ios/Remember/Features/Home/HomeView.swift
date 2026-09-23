import SwiftUI

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedNeed: ReturnCue?
    @State private var dismissedContextualIDs: Set<UUID> = []
    @State private var completedReturn: TodayReturn?
    @State private var completedReturnIDs: Set<UUID> = []
    @State private var returnPresentationID = UUID()
    @State private var addTaskIsPresented = false
    @State private var savedIdeasAreExpanded = false

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        HomeWelcomeHeader()
                        LifeDashboardSection()
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) { savedIdeasAreExpanded.toggle() }
                        } label: {
                            HStack {
                                Text("Saved ideas")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: savedIdeasAreExpanded ? "chevron.up" : "chevron.down")
                                    .foregroundStyle(RememberDesign.secondaryText)
                            }
                            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                            .padding(.horizontal, RememberDesign.spacing)
                            .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("remember.today.savedIdeas")
                        .accessibilityValue(savedIdeasAreExpanded ? "Expanded" : "Collapsed")
                        if savedIdeasAreExpanded {
                            savedIdeasContent
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, RememberDesign.spacing)
                }
                .scrollContentBackground(.visible)
            }
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .rememberPrimaryActions()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                TaskQuickAddBar {
                    addTaskIsPresented = true
                }
            }
            .sheet(isPresented: $addTaskIsPresented) { LifeTaskComposerView() }
            .onDisappear {
                returnPresentationID = UUID()
                completedReturn = nil
            }
        }
    }

    @ViewBuilder
    private var savedIdeasContent: some View {
        ReturnMomentStrip(selection: selectedNeed, onSelect: selectNeed)
        if let featuredReturn {
            Text(featuredReturn.heading)
                .font(.headline)
            returnCard(featuredReturn)
                .id(featuredReturn.imprint.id)
            if completedReturn != nil {
                Button("Done with this return", systemImage: "checkmark") {
                    returnPresentationID = UUID()
                    completedReturn = nil
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .accessibilityIdentifier("remember.today.return.done")
            }
        } else if selectedNeed != nil {
            ContentUnavailableView(
                "Nothing waiting for this moment yet",
                systemImage: "clock.arrow.circlepath",
                description: Text("Open any saved item and choose when you want it to return.")
            )
            .rememberSurface()
        } else if store.isLoading {
            ProgressView("Loading your saves…")
                .frame(maxWidth: .infinity, minHeight: 180)
        } else if weeklySynthesis == nil && store.imprints.isEmpty {
            Button(action: showCapture) {
                Label("Save your first link", systemImage: "plus.circle")
                    .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                    .rememberSurface()
            }
            .buttonStyle(.plain)
        }
        if let weeklySynthesis {
            WeeklySynthesisCard(synthesis: weeklySynthesis)
        }
        if !recentImprints.isEmpty {
            RecentActivitySection(imprints: recentImprints)
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

    private func selectNeed(_ cue: ReturnCue?) {
        returnPresentationID = UUID()
        completedReturn = nil
        completedReturnIDs = []
        selectedNeed = cue
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
        if let selectedNeed {
            return requestedReturn.map { .intentional($0, selectedNeed) }
        }
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

    private var requestedReturn: Imprint? {
        guard let selectedNeed else { return nil }
        return findReturn(for: selectedNeed)
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

    private var weeklySynthesis: WeeklySynthesis? {
        WeeklySynthesisBuilder.build(imprints: store.imprints, life: store.lifeSnapshot)
    }

    private var recentImprints: [Imprint] {
        let featuredID = featuredReturn?.imprint.id
        return Array(store.imprints.filter { $0.id != featuredID }.prefix(3))
    }

    private func showCapture() { store.captureIsPresented = true }
}
