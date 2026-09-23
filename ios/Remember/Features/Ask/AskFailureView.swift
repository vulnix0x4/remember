import SwiftUI

struct AskFailureView: View {
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Label(title, systemImage: "clock.badge.exclamationmark")
                .font(.headline)
                .foregroundStyle(.primary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(RememberDesign.secondaryText)
            Button("Try again", systemImage: "arrow.clockwise", action: retry)
                .buttonStyle(.borderedProminent)
                .foregroundStyle(RememberDesign.accentInk)
                .controlSize(.large)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(RememberDesign.spacing)
        .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: RememberDesign.cornerRadius)
                .stroke(RememberDesign.line, lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
    }
}
