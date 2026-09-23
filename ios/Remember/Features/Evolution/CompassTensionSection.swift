import SwiftUI

struct CompassTensionSection: View {
    let tension: EvolutionTension
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text("STILL UNRESOLVED")
                .font(.caption)
                .bold()
                .foregroundStyle(RememberDesign.secondaryText)
            Text("Two ideas worth holding together")
                .font(.title2)
                .bold()
            Text(tension.explanation)
                .font(.title3)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                EvolutionSourceLink(itemID: tension.fromItemId, imprints: store.imprints)
                EvolutionSourceLink(itemID: tension.toItemId, imprints: store.imprints)
            }
        }
        .padding(.leading, RememberDesign.spacing)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(RememberDesign.accent)
                .frame(width: 2)
                .accessibilityHidden(true)
        }
    }
}
