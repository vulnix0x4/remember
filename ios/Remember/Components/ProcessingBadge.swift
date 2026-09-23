import SwiftUI

struct ProcessingBadge: View {
    let state: ProcessingState
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @ViewBuilder
    var body: some View {
        if state != .ready {
            Label(state.label, systemImage: state.symbol)
                .font(.footnote)
                .foregroundStyle(state == .failed ? RememberDesign.danger : RememberDesign.secondaryText)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
        }
    }
}
