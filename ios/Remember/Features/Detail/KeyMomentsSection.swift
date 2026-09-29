import SwiftUI

struct KeyMomentsSection: View {
    let imprint: Imprint
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Key moments")
            ForEach(imprint.moments) { moment in
                Button { openURL(timestampURL(seconds: moment.seconds)) } label: {
                    HStack(alignment: .top, spacing: RememberDesign.spacing) {
                        Text(moment.timestamp)
                            .font(.subheadline.monospacedDigit().weight(.bold))
                            .foregroundStyle(RememberDesign.text2)
                        VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                            Text(moment.title).font(.rememberRowTitle).foregroundStyle(RememberDesign.text)
                            Text(moment.detail).font(.subheadline).foregroundStyle(RememberDesign.text2)
                        }
                        Spacer()
                        Image(systemName: "play.fill")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(RememberDesign.text)
                            .frame(width: 36, height: 36)
                            .background(RememberDesign.cardRaised, in: .circle)
                    }
                    .padding(RememberDesign.spacing)
                    .frame(minHeight: RememberDesign.rowHeight)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                    .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
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
