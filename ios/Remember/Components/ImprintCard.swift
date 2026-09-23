import SwiftUI

struct ImprintCard: View {
    let imprint: Imprint
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                details
            } else {
                HStack(alignment: .top, spacing: RememberDesign.spacing) {
                    ArchiveArtwork(imprint: imprint, width: 76, height: 76)
                    details
                }
            }
        }
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(RememberDesign.line)
                .frame(height: 1)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("remember.library.imprint.\(imprint.id.uuidString)")
        .accessibilityLabel("\(imprint.title). \(imprint.essence). \(imprint.state.label)")
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 7) {
            ImprintCardMetadata(imprint: imprint)
            Text(imprint.title)
                .font(.headline)
                .bold()
                .foregroundStyle(.primary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
            Text("\(imprint.creator) · \(imprint.savedAt.formatted(.relative(presentation: .named)))")
                .font(.caption)
                .foregroundStyle(RememberDesign.secondaryText)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
