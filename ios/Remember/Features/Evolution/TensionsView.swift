import SwiftUI

struct TensionsView: View {
    let tensions: [EvolutionTension]
    let imprints: [Imprint]

    var body: some View {
        if tensions.isEmpty {
            ContentUnavailableView(
                "No useful contrasts yet",
                systemImage: "arrow.left.arrow.right",
                description: Text("Contrasts appear when two saves approach the same idea differently.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("Different ways to see it")
                    .font(.title2)
                    .bold()
                ForEach(tensions) { tension in
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        Text(tension.explanation)
                            .font(.body)
                            .fontWeight(.semibold)
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            EvolutionSourceLink(itemID: tension.fromItemId, imprints: imprints)
                            EvolutionSourceLink(itemID: tension.toItemId, imprints: imprints)
                        }
                        .font(.subheadline)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberSurface()
                }
            }
        }
    }

}
