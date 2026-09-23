import SwiftUI

struct AskMessageView: View {
    let message: AskMessage
    let imprints: [Imprint]
    @State private var showsSources = false

    var body: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: RememberDesign.spacingSmall) {
            if message.role == .user {
                Text(message.text)
                    .font(.body.weight(.medium))
                    .foregroundStyle(RememberDesign.text)
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.vertical, RememberDesign.spacingCompact)
                    .background(RememberDesign.cardRaised, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                    .frame(maxWidth: 320, alignment: .trailing)
            } else {
                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    Label(
                        message.grounded == true ? "From your saves" : "Not enough in your saves yet",
                        systemImage: message.grounded == true ? "checkmark.seal.fill" : "exclamationmark.circle"
                    )
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text2)

                    Text(message.text)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)

                    ForEach(message.limitations.prefix(1), id: \.self) { limitation in
                        Text(limitation)
                            .font(.rememberMeta)
                            .foregroundStyle(RememberDesign.text3)
                    }

                    if !message.citations.isEmpty {
                        Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                        Button {
                            withAnimation(.snappy(duration: 0.2)) { showsSources.toggle() }
                        } label: {
                            Label("Supporting saves", systemImage: "bookmark")
                        }
                        .buttonStyle(.rememberQuiet)
                        .accessibilityValue(showsSources ? "Shown" : "Hidden")
                        .accessibilityHint(CountLabelFormatter.text(message.citations.count, singular: "save"))

                        if showsSources {
                            ForEach(message.citations) { citation in
                                if let imprint = imprints.first(where: { $0.id == citation.itemID }) {
                                    NavigationLink(value: imprint) {
                                        citationRow(citationLabel(citation), systemImage: "chevron.right")
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    Link(destination: citation.url) {
                                        citationRow(citationLabel(citation), systemImage: "arrow.up.right")
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)

                AskOutcomeActions(message: message, imprints: imprints)
            }
        }
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }

    private func citationRow(_ title: String, systemImage: String) -> some View {
        HStack(spacing: RememberDesign.spacingSmall) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(RememberDesign.text)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            Image(systemName: systemImage)
                .font(.footnote.weight(.bold))
                .foregroundStyle(RememberDesign.text3)
        }
        .padding(.horizontal, RememberDesign.spacing)
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
        .background(RememberDesign.cardRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title)
    }

    private func citationLabel(_ citation: Citation) -> String {
        guard let seconds = citation.seconds else { return citation.title }
        return "\(citation.title) · \(seconds / 60):\((seconds % 60).formatted(.number.precision(.integerLength(2))))"
    }
}
