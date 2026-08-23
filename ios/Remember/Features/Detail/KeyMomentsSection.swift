import SwiftUI

struct KeyMomentsSection: View {
    let imprint: Imprint
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Source grounded", title: "Key moments")
            ForEach(imprint.moments) { moment in
                Button { openURL(timestampURL(seconds: moment.seconds)) } label: {
                    HStack(alignment: .top, spacing: RememberDesign.spacing) {
                        Text(moment.timestamp)
                            .font(.headline.monospacedDigit())
                            .foregroundStyle(RememberDesign.accent)
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            Text(moment.title).font(.headline).foregroundStyle(.primary)
                            Text(moment.detail).font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                        }
                        Spacer()
                        Image(systemName: "play.circle.fill").foregroundStyle(RememberDesign.accent)
                    }
                    .padding(RememberDesign.spacing)
                    .background(Color.secondary.opacity(0.1), in: .rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the original video at \(moment.timestamp)")
            }
        }
    }

    private func timestampURL(seconds: Int) -> URL {
        guard var components = URLComponents(url: imprint.url, resolvingAgainstBaseURL: false) else { return imprint.url }
        var query = components.queryItems ?? []
        query.removeAll { $0.name == "t" }
        query.append(URLQueryItem(name: "t", value: "\(seconds)s"))
        components.queryItems = query
        return components.url ?? imprint.url
    }
}
