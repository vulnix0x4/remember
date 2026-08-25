import SwiftUI

struct EvolutionView: View {
    @Environment(AppStore.self) private var store
    @State private var section: EvolutionSection = .themes

    private var analyzedSourceCount: Int {
        store.imprints.count(where: { $0.state == .ready })
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            Text("ONLY WHAT YOUR SOURCES SUPPORT")
                                .font(.subheadline)
                                .bold()
                                .foregroundStyle(RememberDesign.accent)
                            Text("Patterns in what you’ve saved")
                                .font(.largeTitle)
                                .bold()
                            Text("\(CountLabelFormatter.text(analyzedSourceCount, singular: "analyzed source")). Counts describe your current library, not a psychological profile or a trend.")
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        if store.isLoadingEvolution {
                            ProgressView("Reading your analyzed sources…")
                                .frame(maxWidth: .infinity, minHeight: 240)
                        } else if store.evolutionLoadFailed {
                            ContentUnavailableView {
                                Label("Patterns unavailable", systemImage: "wifi.exclamationmark")
                            } description: {
                                Text("Your library is still safe. Remember couldn’t load its evidence-backed overview just now.")
                            } actions: {
                                Button("Try again", systemImage: "arrow.clockwise", action: reload)
                            }
                        } else if analyzedSourceCount == 0 || store.evolutionOverview.isEmpty {
                            ContentUnavailableView(
                                "Not enough evidence yet",
                                systemImage: "chart.dots.scatter",
                                description: Text("Evolution appears only when analyzed sources provide themes, principles, tensions, or history. Nothing is filled in with demo data.")
                            )
                        } else {
                            Picker("Evolution view", selection: $section) {
                                ForEach(EvolutionSection.allCases) { Text($0.rawValue).tag($0) }
                            }
                            .pickerStyle(.segmented)
                            Group {
                                switch section {
                                case .themes: ThemesView(themes: store.evolutionOverview.themes)
                                case .principles: PrinciplesView(principles: store.evolutionOverview.principles, imprints: store.imprints)
                                case .tensions: TensionsView(tensions: store.evolutionOverview.tensions, imprints: store.imprints)
                                case .timeline: TimelineView(entries: store.evolutionOverview.timeline)
                                }
                            }
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .refreshable { await store.loadDerivedData() }
        }
    }

    private func reload() {
        Task { await store.loadDerivedData() }
    }
}
