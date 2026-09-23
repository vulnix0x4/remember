import SwiftUI

struct ImprintHero: View {
    let imprint: Imprint
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            if imprint.sourceType != .note {
                ArchiveArtwork(imprint: imprint, height: dynamicTypeSize.isAccessibilitySize ? 152 : 238)
            }
            Label("\(imprint.sourceLabel) · \(imprint.creator)", systemImage: sourceSymbol)
                .font(.caption)
                .foregroundStyle(RememberDesign.secondaryText)
            if let scope = imprint.analysisScopeLabel {
                Label(scope, systemImage: "checkmark.shield")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(RememberDesign.accent)
            }
            if imprint.sourceType == .note, let noteText = imprint.noteText {
                Text("Your words")
                    .font(.caption.bold())
                    .foregroundStyle(RememberDesign.accent)
                    .textCase(.uppercase)
                Text(noteText)
                    .font(.title2.weight(.semibold))
                    .lineSpacing(5)
                    .textSelection(.enabled)
            } else {
                Text(imprint.title)
                    .font(.title)
                    .bold()
            }
            if imprint.sourceType == .note {
                Text("Remember’s reflection")
                    .font(.caption.bold())
                    .foregroundStyle(RememberDesign.secondaryText)
                    .textCase(.uppercase)
            }
            Text(imprint.essence)
                .font(.title3)
                .fontWeight(.semibold)
                .lineSpacing(4)
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Label(imprint.lifePeriod, systemImage: "calendar")
                        ProcessingBadge(state: imprint.state)
                    }
                } else {
                    HStack {
                        Label(imprint.lifePeriod, systemImage: "calendar")
                        Spacer()
                        ProcessingBadge(state: imprint.state)
                    }
                }
            }
            .font(.footnote)
            if !imprint.summary.isEmpty {
                Divider().overlay { RememberDesign.line }
                Text(imprint.summary)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
                    .lineSpacing(4)
            }
            if !imprint.themes.isEmpty {
                ScrollView(.horizontal) {
                    HStack { ForEach(imprint.themes, id: \.self) { ThemeChip(name: $0) } }
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    private var sourceSymbol: String {
        if imprint.sourceType == .note { return "quote.bubble" }
        return imprint.isVideoSource ? "play.rectangle.fill" : "safari"
    }

}
