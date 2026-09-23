import SwiftUI

struct ImprintCardMetadata: View {
    let imprint: Imprint
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    sourceLabel
                    ProcessingBadge(state: imprint.state)
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacingSmall) {
                    sourceLabel
                    ProcessingBadge(state: imprint.state)
                }
            }
        }
    }

    private var sourceLabel: some View {
        Text(imprint.sourceLabel)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(RememberDesign.secondaryText)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
    }
}
