import SwiftUI

struct HomeView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        HomeWelcomeHeader(saveAction: showCapture)
                        LifeDashboardSection()
                        if let resurfaced = store.resurfaced {
                            NavigationLink(value: resurfaced) {
                                ResurfacedCard(imprint: resurfaced)
                            }
                            .buttonStyle(.plain)
                        } else if store.isLoading {
                            ProgressView("Opening your memory…")
                                .frame(maxWidth: .infinity, minHeight: 180)
                        } else {
                            if store.imprints.isEmpty {
                                ContentUnavailableView(
                                    "Your memory starts here",
                                    systemImage: "bookmark",
                                    description: Text("Save one meaningful link and Remember will begin finding what stays with you.")
                                )
                            } else {
                                ContentUnavailableView(
                                    "Nothing old enough to resurface yet",
                                    systemImage: "clock.arrow.circlepath",
                                    description: Text("Recent saves stay in your Library. Remember starts resurfacing a Ready idea after it has been saved for at least seven days.")
                                )
                            }
                        }
                        if !store.imprints.isEmpty {
                            RecentActivitySection(imprints: Array(store.imprints.prefix(3)))
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .scrollContentBackground(.visible)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
        }
    }

    private func showCapture() { store.captureIsPresented = true }
}
