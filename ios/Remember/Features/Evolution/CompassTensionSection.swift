import SwiftUI

struct CompassTensionSection: View {
    let tension: EvolutionTension
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Still unresolved")
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(tension.explanation)
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
                EvolutionSourceLink(itemID: tension.fromItemId, imprints: store.imprints)
                EvolutionSourceLink(itemID: tension.toItemId, imprints: store.imprints)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing)
        }
    }
}
