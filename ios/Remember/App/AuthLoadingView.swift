import SwiftUI

struct AuthLoadingView: View {
    var body: some View {
        ZStack {
            WarmBackground()
            VStack(spacing: RememberDesign.spacing) {
                Image("AppIcon")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 58, height: 58)
                    .clipShape(.rect(cornerRadius: 17))
                    .accessibilityHidden(true)
                ProgressView("Opening your archive…")
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }
}
