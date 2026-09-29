import SwiftUI

struct EvolutionView: View {
    @Environment(AppStore.self) private var store
    @Binding private var librarySection: LibrarySection
    @State private var section: EvolutionSection = .compass

    init(librarySection: Binding<LibrarySection> = .constant(.patterns)) {
        _librarySection = librarySection
    }

    private var analyzedSourceCount: Int {
        store.imprints.count(where: { $0.state == .ready })
    }

    private var livingThreads: [LivingThread] {
        LivingThreadBuilder.build(from: store.imprints, reflections: store.evolutionOverview.reflections)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $librarySection,
                    choices: LibrarySection.allCases,
                    accessibilityIdentifier: "remember.section.library",
                    title: { $0.rawValue }
                )
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        if store.isLoadingEvolution {
                            ProgressView("Checking your saves…")
                                .tint(RememberDesign.text2)
                                .frame(maxWidth: .infinity, minHeight: 240)
                        } else if store.evolutionLoadFailed {
                            RememberEmptyState(
                                systemImage: "wifi.exclamationmark",
                                title: "Couldn’t load patterns",
                                message: "Your saves are safe.",
                                actionTitle: "Try again",
                                action: reload
                            )
                        } else if analyzedSourceCount == 0 || (store.evolutionOverview.isEmpty && livingThreads.isEmpty) {
                            RememberEmptyState(
                                systemImage: "square.stack.3d.up",
                                title: analyzedSourceCount == 0 ? "No patterns yet" : "Not enough overlap yet",
                                message: analyzedSourceCount == 0 ? "Save a few things and they’ll show up here." : "Keep saving. Patterns need a few related saves."
                            )
                        } else {
                            if let weeklySynthesis = WeeklySynthesisBuilder.build(imprints: store.imprints, life: store.lifeSnapshot) {
                                WeeklySynthesisCard(synthesis: weeklySynthesis)
                            }
                            PatternSectionControl(selection: $section)

                            Group {
                                switch section {
                                case .compass:
                                    PersonalCompassView(
                                        compass: PersonalCompassBuilder.build(
                                            overview: store.evolutionOverview,
                                            life: store.lifeSnapshot,
                                            imprints: store.imprints
                                        )
                                    )
                                case .themes: LivingThreadsView(imprints: store.imprints, reflections: store.evolutionOverview.reflections)
                                case .principles: PrinciplesView(principles: store.evolutionOverview.principles, imprints: store.imprints)
                                case .tensions: TensionsView(tensions: store.evolutionOverview.tensions, imprints: store.imprints)
                                case .timeline: TimelineView(entries: store.evolutionOverview.timeline)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacingSmall)
                    .padding(.bottom, RememberDesign.spacingXLarge)
                }
                .background(RememberDesign.canvas)
            }
            .navigationDestination(for: LivingThread.self) { LivingThreadDetailView(thread: $0) }
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .refreshable { await store.loadDerivedData() }
            .rememberBottomDock {
                AddBar(placeholder: "Save a link or thought…", accessibilityIdentifier: "remember.library.quickSave") {
                    await store.quickSave($0)
                }
            }
            .rememberPrimaryActions()
        }
    }

    private func reload() {
        Task { await store.loadDerivedData() }
    }
}
