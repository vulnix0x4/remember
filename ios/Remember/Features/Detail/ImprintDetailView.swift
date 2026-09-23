import SwiftUI

struct ImprintDetailView: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL

    private var currentImprint: Imprint {
        store.imprint(withID: imprint.id) ?? imprint
    }

    var body: some View {
        ZStack {
            WarmBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    ImprintHero(imprint: currentImprint)
                    if currentImprint.state == .processing {
                        ProcessingDetailState()
                    } else if currentImprint.state == .failed {
                        FailedDetailState(imprint: currentImprint)
                    } else {
                        if currentImprint.state == .partial {
                            Label("Some details aren’t available for this source.", systemImage: "circle.lefthalf.filled")
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.secondaryText)
                                .rememberSurface()
                        }
                        if !currentImprint.keyIdeas.isEmpty {
                            ImprintIdeasSection(ideas: currentImprint.keyIdeas)
                        }
                        if !currentImprint.moments.isEmpty {
                            KeyMomentsSection(imprint: currentImprint)
                        }
                        BringBackSection(imprint: currentImprint)
                        if !currentImprint.experiments.isEmpty {
                            CarryForwardSection(imprint: currentImprint)
                        }
                        if !currentImprint.candidatePrinciples.isEmpty || !currentImprint.experiments.isEmpty {
                            PrincipleSection(imprint: currentImprint)
                        }
                        if !currentImprint.personalHypotheses.isEmpty || !currentImprint.uncertainties.isEmpty {
                            PersonalMeaningSection(hypotheses: currentImprint.personalHypotheses, uncertainties: currentImprint.uncertainties)
                        }
                        if !currentImprint.connections.isEmpty {
                            ConnectionsSection(connections: currentImprint.connections)
                        }
                    }
                }
                .padding(RememberDesign.spacing)
                .padding(.bottom, 96)
            }
        }
        .navigationTitle("Saved item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            if currentImprint.sourceType != .note {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Open original", systemImage: "arrow.up.right.square", action: openOriginal)
                }
            }
        }
        .task(id: currentImprint.id) { await store.loadDetail(currentImprint) }
    }

    private func openOriginal() {
        openURL(currentImprint.url)
    }
}
