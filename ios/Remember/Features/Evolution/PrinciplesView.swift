import SwiftUI

struct PrinciplesView: View {
    let principles: [EvolutionPrinciple]
    let imprints: [Imprint]

    var body: some View {
        if principles.isEmpty {
            RememberEmptyState(
                systemImage: "quote.bubble",
                title: "No takeaways yet",
                message: "They show up when a save has a clear one."
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Takeaways")
                ForEach(principles) { principle in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text(principle.text)
                            .font(.rememberRowTitle)
                        if let rationale = principle.rationale, !rationale.isEmpty {
                            Text(rationale)
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.text2)
                        }
                        if let imprint = imprint(for: principle.itemId) {
                            NavigationLink(value: imprint) {
                                Label(imprint.title, systemImage: "bookmark")
                                    .lineLimit(1)
                            }
                            .buttonStyle(.rememberQuiet)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
                }
            }
        }
    }

    private func imprint(for id: String) -> Imprint? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return imprints.first(where: { $0.id == uuid })
    }
}
