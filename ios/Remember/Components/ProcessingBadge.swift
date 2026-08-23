import SwiftUI

struct ProcessingBadge: View {
    let state: ProcessingState

    var body: some View {
        Label(state.label, systemImage: state.symbol)
            .font(.footnote)
            .foregroundStyle(state == .failed ? Color.red : RememberDesign.secondaryText)
            .fixedSize(horizontal: true, vertical: false)
    }
}
