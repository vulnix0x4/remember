import SwiftUI

struct AuthLoadingView: View {
    var body: some View {
        ZStack {
            RememberDesign.canvas.ignoresSafeArea()
            VStack(spacing: RememberDesign.spacing) {
                RememberMark(size: 58)
                ProgressView("Opening…")
                    .tint(RememberDesign.text2)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }
}
