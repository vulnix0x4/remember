import SwiftUI

struct AskMessageView: View {
    let message: AskMessage
    let imprints: [Imprint]

    var body: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: RememberDesign.spacing) {
            Text(message.text)
                .font(.body)
                .padding(RememberDesign.spacing)
                .background(message.role == .user ? RememberDesign.accent : Color.secondary.opacity(0.1), in: .rect(cornerRadius: 18))
                .foregroundStyle(message.role == .user ? .white : .primary)
            if message.role == .assistant {
                if message.grounded == true {
                    Label("Grounded in your library", systemImage: "checkmark.seal")
                        .font(.footnote)
                        .bold()
                        .foregroundStyle(RememberDesign.secondaryText)
                } else {
                    Label("Not enough supporting material", systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .bold()
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                ForEach(message.citations) { citation in
                    if let imprint = imprints.first(where: { $0.id == citation.itemID }) {
                        NavigationLink(value: imprint) {
                            Label(citationLabel(citation), systemImage: "bookmark.fill")
                                .font(.footnote)
                                .multilineTextAlignment(.leading)
                        }
                        .buttonStyle(.bordered)
                    } else {
                        Link(destination: citation.url) {
                            Label(citationLabel(citation), systemImage: "arrow.up.right.square")
                                .font(.footnote)
                                .multilineTextAlignment(.leading)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                ForEach(message.limitations, id: \.self) { limitation in
                    Text(limitation)
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.tertiaryText)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }

    private func citationLabel(_ citation: Citation) -> String {
        guard let seconds = citation.seconds else { return citation.title }
        return "\(citation.title) · \(seconds / 60):\((seconds % 60).formatted(.number.precision(.integerLength(2))))"
    }
}
