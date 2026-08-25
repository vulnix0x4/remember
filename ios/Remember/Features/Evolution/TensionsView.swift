import SwiftUI

struct TensionsView: View {
    let tensions: [EvolutionTension]
    let imprints: [Imprint]

    var body: some View {
        if tensions.isEmpty {
            ContentUnavailableView(
                "No possible tension yet",
                systemImage: "arrow.left.arrow.right",
                description: Text("Remember suggests a tension when two analyzed sources appear to pull in different directions. You decide whether the comparison is useful.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                SectionHeader(eyebrow: "Across two sources", title: "Tensions")
                ForEach(tensions) { tension in
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        Text(tension.explanation)
                            .font(.title3)
                        HStack {
                            EvolutionSourceLink(itemID: tension.fromItemId, imprints: imprints)
                            Spacer()
                            Image(systemName: "arrow.left.arrow.right")
                                .foregroundStyle(RememberDesign.accent)
                                .accessibilityHidden(true)
                            Spacer()
                            EvolutionSourceLink(itemID: tension.toItemId, imprints: imprints)
                        }
                        .font(.subheadline)
                    }
                    .padding(RememberDesign.spacing)
                    .background(.background, in: .rect(cornerRadius: 14))
                }
            }
        }
    }

}
