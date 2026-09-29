import SwiftUI

struct FailedDetailState: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @State private var isRetrying = false

    var body: some View {
        VStack(spacing: RememberDesign.spacingSmall) {
            RememberEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn’t read this one",
                message: imprint.uncertainties.first ?? "The link is still safe.",
                actionTitle: isRetrying ? "Trying again…" : "Try again",
                action: retry
            )
            .disabled(isRetrying)
            if imprint.sourceType != .note {
                Button("Open original", systemImage: "arrow.up.right.square", action: openOriginal)
                    .buttonStyle(.rememberQuiet)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func retry() {
        isRetrying = true
        Task {
            await store.retry(imprint)
            isRetrying = false
        }
    }

    private func openOriginal() {
        openURL(imprint.url)
    }
}
