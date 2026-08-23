import SwiftUI

struct ImprintCardMetadata: View {
    let imprint: Imprint

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacingSmall) {
                sourceLabel
                Spacer(minLength: RememberDesign.spacingSmall)
                ProcessingBadge(state: imprint.state)
            }

            VStack(alignment: .leading, spacing: 4) {
                sourceLabel
                ProcessingBadge(state: imprint.state)
            }
        }
    }

    private var sourceLabel: some View {
        Text(imprint.sourceLabel.uppercased())
            .font(.caption)
            .bold()
            .tracking(0.8)
            .foregroundStyle(RememberDesign.accent)
            .fixedSize(horizontal: false, vertical: true)
    }
}
