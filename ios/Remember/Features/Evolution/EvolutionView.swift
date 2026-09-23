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
                ZStack {
                    WarmBackground()
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        if store.isLoadingEvolution {
                            ProgressView("Checking your saves…")
                                .frame(maxWidth: .infinity, minHeight: 240)
                        } else if store.evolutionLoadFailed {
                            ContentUnavailableView {
                                Label("Patterns unavailable", systemImage: "wifi.exclamationmark")
                            } description: {
                                Text("Your saves are safe. Remember couldn’t load their shared patterns just now.")
                            } actions: {
                                Button("Try again", systemImage: "arrow.clockwise", action: reload)
                            }
                        } else if analyzedSourceCount == 0 || (store.evolutionOverview.isEmpty && livingThreads.isEmpty) {
                            ContentUnavailableView(
                                analyzedSourceCount == 0 ? "Patterns will appear here" : "No recurring patterns yet",
                                systemImage: "square.stack.3d.up",
                                description: Text(analyzedSourceCount == 0
                                    ? "Save a few links and recurring topics and useful connections will appear here."
                                    : "There is not enough overlap between your saves to show a useful pattern yet.")
                            )
                        } else {
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
                        .padding(RememberDesign.spacing)
                        .padding(.bottom, RememberDesign.spacingXLarge)
                    }
                }
            }
            .navigationTitle("Patterns")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: LivingThread.self) { LivingThreadDetailView(thread: $0) }
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .refreshable { await store.loadDerivedData() }
            .rememberPrimaryActions()
        }
    }

    private func reload() {
        Task { await store.loadDerivedData() }
    }
}
