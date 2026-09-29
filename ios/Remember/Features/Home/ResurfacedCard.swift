import SwiftUI

struct ResurfacedCard: View {
    let imprint: Imprint
    var onReflectionSaved: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text("Saved \(imprint.savedAt, format: .relative(presentation: .named))")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text2)
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text(imprint.essence)
                    .font(.rememberSectionTitle)
                    .fixedSize(horizontal: false, vertical: true)
                Text(imprint.title)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .lineLimit(1)
            }
            NavigationLink(value: imprint) {
                Label("Open saved item", systemImage: "arrow.right")
            }
            .buttonStyle(.rememberSecondary)
            MemoryCheckIn(imprint: imprint, onSaved: onReflectionSaved)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
    }
}
