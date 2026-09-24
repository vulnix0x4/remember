import SwiftUI

struct TensionsView: View {
    let tensions: [EvolutionTension]
    let imprints: [Imprint]

    var body: some View {
        if tensions.isEmpty {
            RememberEmptyState(
                systemImage: "arrow.left.arrow.right",
                title: "No contrasts yet",
                message: "They show up when two saves disagree."
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Different ways to see it")
                ForEach(tensions) { tension in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(tension.explanation)
                            .font(.body.weight(.semibold))
                        EvolutionSourceLink(itemID: tension.fromItemId, imprints: imprints)
                        EvolutionSourceLink(itemID: tension.toItemId, imprints: imprints)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
                }
            }
        }
    }
}
