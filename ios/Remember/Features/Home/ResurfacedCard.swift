import SwiftUI

struct ResurfacedCard: View {
    let imprint: Imprint
    var onReflectionSaved: () -> Void = {}
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(spacing: 0) {
            ArchiveArtwork(imprint: imprint, height: dynamicTypeSize.isAccessibilitySize ? 120 : 172)
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Group {
                    if dynamicTypeSize.isAccessibilitySize {
                        Label("Saved \(imprint.savedAt, format: .relative(presentation: .named))", systemImage: "clock")
                    } else {
                        HStack {
                            Text("Saved \(imprint.savedAt, format: .relative(presentation: .named))")
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                    }
                }
                .font(.caption)
                .foregroundStyle(RememberDesign.secondaryText)
                Text(imprint.essence)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(imprint.title)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                    .lineLimit(2)
                MemoryCheckIn(imprint: imprint, onSaved: onReflectionSaved)
                NavigationLink(value: imprint) {
                    Label("Open saved item", systemImage: "arrow.right")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .padding(.top, RememberDesign.spacingSmall)
            }
            .padding(RememberDesign.spacing)
        }
        .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .clipShape(.rect(cornerRadius: RememberDesign.cornerRadius))
    }
}
