import SwiftUI

struct ResurfacedCard: View {
    let imprint: Imprint
    @State private var showsMeaning = false

    var body: some View {
        VStack(spacing: 0) {
            ArchiveArtwork(imprint: imprint, height: 214)
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Label {
                    Text("Saved \(imprint.savedAt, format: .relative(presentation: .named))")
                } icon: {
                    Image(systemName: "clock.arrow.circlepath")
                }
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(RememberDesign.accent)
                Text(imprint.essence)
                    .font(.title2)
                    .bold()
                    .tracking(-0.45)
                    .foregroundStyle(.primary)
                Text(imprint.title)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                Divider().overlay(RememberDesign.line)
                DisclosureGroup("Why it may have mattered", isExpanded: $showsMeaning) {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(imprint.personalHypotheses.first ?? "You saved this during \(imprint.lifePeriod.lowercased()).")
                            .font(.body)
                            .foregroundStyle(RememberDesign.secondaryText)
                        Text("A possibility based only on your saved material")
                            .font(.footnote)
                            .foregroundStyle(RememberDesign.tertiaryText)
                    }
                    .padding(.top, RememberDesign.spacingSmall)
                }
                .font(.headline)
            }
            .padding(RememberDesign.spacingLarge)
        }
        .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .overlay { RoundedRectangle(cornerRadius: RememberDesign.cornerRadius).stroke(RememberDesign.line) }
        .shadow(color: .black.opacity(0.24), radius: 30, y: 18)
    }
}
