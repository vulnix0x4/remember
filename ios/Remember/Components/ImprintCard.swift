import SwiftUI

struct ImprintCard: View {
    let imprint: Imprint
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                details
            } else {
                HStack(alignment: .center, spacing: RememberDesign.spacingCompact) {
                    ArchiveArtwork(imprint: imprint, width: 64, height: 64)
                    details
                }
            }
        }
        .padding(RememberDesign.spacingCompact)
        .frame(minHeight: RememberDesign.rowHeight)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("remember.library.imprint.\(imprint.id.uuidString)")
        .accessibilityLabel("\(imprint.title). \(imprint.essence). \(imprint.state.label)")
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 4) {
            ImprintCardMetadata(imprint: imprint)
            Text(imprint.title)
                .font(.rememberRowTitle)
                .foregroundStyle(.white)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
            Text("\(imprint.creator) · \(imprint.savedAt.formatted(.relative(presentation: .named)))")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text2)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
