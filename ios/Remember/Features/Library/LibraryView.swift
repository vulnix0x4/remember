import SwiftUI

struct LibraryView: View {
    @Environment(AppStore.self) private var store
    @State private var searchText = ""
    @State private var filter: LibraryFilter = .all

    private var filteredImprints: [Imprint] {
        store.imprints.filter { imprint in
            let matchesFilter = filter == .all || imprint.state.rawValue == filter.rawValue
            let matchesSearch = searchText.isEmpty || [imprint.title, imprint.essence, imprint.themes.joined(separator: " ")]
                .contains(where: { $0.localizedStandardContains(searchText) })
            return matchesFilter && matchesSearch
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                VStack(spacing: RememberDesign.spacing) {
                    HStack {
                        Text("Library")
                            .font(.largeTitle)
                            .bold()
                        Spacer()
                        SaveSomethingButton(action: showCapture)
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    LibrarySearchField(text: $searchText)
                        .padding(.horizontal, RememberDesign.spacing)
                    Group {
                        if !searchText.isEmpty && filteredImprints.isEmpty {
                            ContentUnavailableView.search
                        } else if store.imprints.isEmpty && !store.isLoading {
                            ContentUnavailableView("Nothing saved yet", systemImage: "books.vertical", description: Text("Save a link to begin your personal archive."))
                        } else {
                            ScrollView {
                                LazyVStack(spacing: RememberDesign.spacing) {
                                    ScrollView(.horizontal) {
                                        HStack(spacing: RememberDesign.spacingSmall) {
                                            ForEach(LibraryFilter.allCases) { option in
                                                Button {
                                                    filter = option
                                                } label: {
                                                    Text(option.rawValue)
                                                        .font(.subheadline.weight(.semibold))
                                                        .padding(.horizontal, 16)
                                                        .frame(minHeight: 44)
                                                        .foregroundStyle(option == filter ? RememberDesign.accent : .primary)
                                                        .background(option == filter ? RememberDesign.accent.opacity(0.14) : .clear, in: Capsule())
                                                        .overlay {
                                                            Capsule()
                                                                .stroke(RememberDesign.secondaryText.opacity(option == filter ? 0 : 0.32))
                                                        }
                                                }
                                                .buttonStyle(.plain)
                                                .accessibilityAddTraits(option == filter ? .isSelected : [])
                                            }
                                        }
                                    }
                                    .scrollIndicators(.hidden)
                                    .accessibilityLabel("Processing status")
                                    .padding(.bottom, RememberDesign.spacingSmall)
                                    ForEach(filteredImprints) { imprint in
                                        NavigationLink(value: imprint) { ImprintCard(imprint: imprint) }
                                            .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, RememberDesign.spacing)
                                .padding(.bottom, 96)
                            }
                        }
                    }
                }
                .padding(.top, RememberDesign.spacingSmall)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .refreshable { await store.load() }
        }
    }

    private func showCapture() { store.captureIsPresented = true }
}
