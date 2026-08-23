import SwiftUI

struct EvolutionSourceLink: View {
    let itemID: String
    let imprints: [Imprint]

    var body: some View {
        if let imprint {
            NavigationLink(value: imprint) {
                Label(imprint.title, systemImage: "bookmark")
                    .lineLimit(2)
            }
        } else {
            Label("Saved source", systemImage: "bookmark")
        }
    }

    private var imprint: Imprint? {
        guard let uuid = UUID(uuidString: itemID) else { return nil }
        return imprints.first(where: { $0.id == uuid })
    }
}
