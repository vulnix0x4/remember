import SwiftUI

struct PrinciplesView: View {
    let principles: [EvolutionPrinciple]
    let imprints: [Imprint]

    var body: some View {
        if principles.isEmpty {
            ContentUnavailableView(
                "No takeaways yet",
                systemImage: "quote.bubble",
                description: Text("Useful takeaways appear when a save clearly supports one.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("Takeaways worth revisiting")
                    .font(.title2)
                    .bold()
                Text("Each takeaway comes directly from a saved source.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                ForEach(principles) { principle in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(principle.text)
                            .font(.body)
                            .fontWeight(.semibold)
                        if let rationale = principle.rationale, !rationale.isEmpty {
                            Text(rationale)
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        if let imprint = imprint(for: principle.itemId) {
                            NavigationLink(value: imprint) {
                                Label(imprint.title, systemImage: "bookmark")
                                    .font(.footnote)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberSurface()
                }
            }
        }
    }

    private func imprint(for id: String) -> Imprint? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return imprints.first(where: { $0.id == uuid })
    }
}
