import SwiftUI

struct PrinciplesView: View {
    let principles: [EvolutionPrinciple]
    let imprints: [Imprint]

    var body: some View {
        if principles.isEmpty {
            ContentUnavailableView(
                "No principles yet",
                systemImage: "compass.drawing",
                description: Text("Candidate principles appear only when an analyzed source explicitly supports one.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("Ideas from your sources")
                    .font(.title2)
                    .bold()
                Text("Each candidate below comes from one analyzed source. It is not presented as a repeated belief unless multiple sources support it.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                ForEach(principles) { principle in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Label(principle.text, systemImage: "compass.drawing")
                            .font(.headline)
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
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.background, in: .rect(cornerRadius: 14))
                }
            }
        }
    }

    private func imprint(for id: String) -> Imprint? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return imprints.first(where: { $0.id == uuid })
    }
}
