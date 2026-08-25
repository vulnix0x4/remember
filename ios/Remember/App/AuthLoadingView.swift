import SwiftUI

struct AuthLoadingView: View {
    var body: some View {
        ZStack {
            WarmBackground()
            VStack(spacing: RememberDesign.spacing) {
                RememberMark(size: 58)
                ProgressView("Opening your archive...")
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }
}
