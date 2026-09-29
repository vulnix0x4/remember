import SwiftUI

struct AskFailureView: View {
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Label(title, systemImage: "clock.badge.exclamationmark")
                .font(.rememberRowTitle)
                .foregroundStyle(RememberDesign.text)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(RememberDesign.text2)
            Button("Try again", systemImage: "arrow.clockwise", action: retry)
                .buttonStyle(.rememberSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing)
        .accessibilityElement(children: .contain)
    }
}
