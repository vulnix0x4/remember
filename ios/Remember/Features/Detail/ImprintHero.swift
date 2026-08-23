import SwiftUI

struct ImprintHero: View {
    let imprint: Imprint
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            Button(action: openOriginal) {
                ArchiveArtwork(imprint: imprint, height: 238)
                    .overlay(alignment: .bottomLeading) {
                        Label(imprint.isVideoSource ? "Watch original" : "Read original", systemImage: "arrow.up.right")
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(.white)
                            .padding(.horizontal, RememberDesign.spacing)
                            .frame(minHeight: 44)
                            .background(.black.opacity(0.7), in: .rect(cornerRadius: 12))
                            .overlay { RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.2)) }
                            .padding(RememberDesign.spacing)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open original source: \(imprint.title)")
            .accessibilityHint("Opens in your browser")
            Label("\(imprint.sourceLabel) · \(imprint.creator)", systemImage: imprint.isVideoSource ? "play.rectangle.fill" : "safari")
                .font(.caption)
                .bold()
                .tracking(0.9)
                .foregroundStyle(RememberDesign.accent)
            Text(imprint.title)
                .font(.largeTitle)
                .bold()
                .tracking(-1.1)
            Text(imprint.essence)
                .font(.title3)
                .bold()
                .lineSpacing(4)
            HStack {
                Label(imprint.lifePeriod, systemImage: "calendar")
                Spacer()
                ProcessingBadge(state: imprint.state)
            }
            .font(.footnote)
            if !imprint.summary.isEmpty {
                Divider().overlay(RememberDesign.line)
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

    private func openOriginal() {
        openURL(imprint.url)
    }
}
