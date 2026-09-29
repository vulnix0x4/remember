import SwiftUI

struct LibraryView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @Binding private var librarySection: LibrarySection
    @State private var searchText = ""
    @State private var filter: LibraryFilter = .all
    @State private var newestFirst = true

    init(librarySection: Binding<LibrarySection> = .constant(.saved)) {
        _librarySection = librarySection
    }

    private var filteredImprints: [Imprint] {
        let matches = store.imprints.filter { imprint in
            let matchesFilter = filter.matches(imprint)
            let matchesSearch = searchText.isEmpty || [imprint.title, imprint.noteText ?? "", imprint.essence, imprint.themes.joined(separator: " ")]
                .contains(where: { $0.localizedStandardContains(searchText) })
            return matchesFilter && matchesSearch
        }
        return matches.sorted { newestFirst ? $0.savedAt > $1.savedAt : $0.savedAt < $1.savedAt }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 0) {
                        AdaptiveSectionControl(
                            selection: $librarySection,
                            choices: LibrarySection.allCases,
                            accessibilityIdentifier: "remember.section.library",
                            title: { $0.rawValue }
                        )
                        if !store.imprints.isEmpty {
                            LibrarySearchField(text: $searchText)
                                .padding(.horizontal, RememberDesign.spacing)
                                .padding(.top, RememberDesign.spacingXXSmall)
                            LibraryFilterBar(filter: $filter, newestFirst: $newestFirst)
                        }
                    }
                }
                .listRowInsets(.init())
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)

                if store.isLoading && store.imprints.isEmpty {
                    ForEach(0..<5, id: \.self) { _ in
                        ImprintCard(imprint: FixtureLibrary.imprints[0])
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(.init(top: 4, leading: RememberDesign.spacing, bottom: 4, trailing: RememberDesign.spacing))
                    }
                    .redacted(reason: .placeholder)
                    .allowsHitTesting(false)
                } else if !searchText.isEmpty && filteredImprints.isEmpty {
                    RememberEmptyState(systemImage: "magnifyingglass", title: "No results", message: "Try a different word.")
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                } else if !store.imprints.isEmpty && filteredImprints.isEmpty {
                    RememberEmptyState(
                        systemImage: "line.3.horizontal.decrease.circle",
                        title: "Nothing here",
                        message: "Pick another filter above.",
                        actionTitle: "Show all",
                        action: { filter = .all }
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else if store.imprints.isEmpty {
                    RememberEmptyState(
                        systemImage: "books.vertical",
                        title: "Nothing saved yet",
                        message: "Paste a link or type a thought below."
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(filteredImprints) { imprint in
                        NavigationLink(value: imprint) {
                            ImprintCard(imprint: imprint)
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(.init(top: 4, leading: RememberDesign.spacing, bottom: 4, trailing: RememberDesign.spacing))
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if imprint.sourceType != .note {
                                Button("Open", systemImage: "arrow.up.right.square") {
                                    openURL(imprint.url)
                                }
                                .tint(RememberDesign.cardRaised)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if imprint.sourceType != .note {
                                ShareLink(item: imprint.url) {
                                    Label("Share", systemImage: "square.and.arrow.up")
                                }
                                .tint(RememberDesign.cardRaised)
                            }
                            if imprint.state == .failed {
                                Button("Try analysis again", systemImage: "arrow.clockwise") {
                                    Task { await store.retry(imprint) }
                                }
                                .tint(RememberDesign.cardRaised)
                            }
                        }
                        .contextMenu {
                            if imprint.sourceType != .note {
                                Button("Open original", systemImage: "arrow.up.right.square") {
                                    openURL(imprint.url)
                                }
                                ShareLink(item: imprint.url)
                            }
                            if imprint.state == .failed {
                                Button("Try analysis again", systemImage: "arrow.clockwise") {
                                    Task { await store.retry(imprint) }
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.immediately)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .refreshable { await store.load() }
            .rememberBottomDock {
                AddBar(placeholder: "Save a link or thought…", accessibilityIdentifier: "remember.library.quickSave") {
                    await store.quickSave($0)
                }
            }
            .rememberPrimaryActions()
        }
    }

}
