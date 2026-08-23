import SwiftUI

struct RecentActivitySection: View {
    let imprints: [Imprint]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Your library", title: "Recently saved")
            ForEach(imprints) { imprint in
                NavigationLink(value: imprint) { ImprintCard(imprint: imprint) }
                    .buttonStyle(.plain)
            }
        }
    }
}
