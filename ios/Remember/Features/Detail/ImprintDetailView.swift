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
                LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    ImprintHero(imprint: currentImprint)
                    if currentImprint.state == .processing {
                        ProcessingDetailState()
                    } else if currentImprint.state == .failed {
                        FailedDetailState(imprint: currentImprint)
                    } else {
                        ImprintIdeasSection(ideas: currentImprint.keyIdeas)
                        KeyMomentsSection(imprint: currentImprint)
                        PrincipleSection(principles: currentImprint.candidatePrinciples, experiments: currentImprint.experiments)
                        PersonalMeaningSection(hypotheses: currentImprint.personalHypotheses, uncertainties: currentImprint.uncertainties)
                        ConnectionsSection(connections: currentImprint.connections)
                    }
                }
                .padding(RememberDesign.spacing)
                .padding(.bottom, 96)
            }
        }
        .navigationTitle("Imprint")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Open original", systemImage: "arrow.up.right.square", action: openOriginal)
            }
        }
    }

    private func openOriginal() {
        openURL(currentImprint.url)
    }
}
