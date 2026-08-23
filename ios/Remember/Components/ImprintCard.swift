import SwiftUI

struct ImprintCard: View {
    let imprint: Imprint

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ArchiveArtwork(imprint: imprint, width: 96, height: 96)
            VStack(alignment: .leading, spacing: 7) {
                ImprintCardMetadata(imprint: imprint)
                Text(imprint.title)
                    .font(.headline)
                    .bold()
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(imprint.creator)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
                Text(imprint.savedAt, format: .relative(presentation: .named))
                    .font(.caption)
                    .foregroundStyle(RememberDesign.tertiaryText)
            }
        }
        .padding(.vertical, 15)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(RememberDesign.line)
                .frame(height: 1)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(imprint.title). \(imprint.essence). \(imprint.state.label)")
    }
}
