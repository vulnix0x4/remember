import SwiftUI

struct FailedDetailState: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @State private var isRetrying = false

    var body: some View {
        ContentUnavailableView {
            Label("Couldn’t analyze this save", systemImage: "exclamationmark.triangle")
        } description: {
            Text(imprint.uncertainties.first ?? "The original link remains safe. Try processing again later.")
        } actions: {
            Button(isRetrying ? "Trying again…" : "Try again", systemImage: "arrow.clockwise", action: retry)
                .buttonStyle(.borderedProminent)
                .foregroundStyle(RememberDesign.accentInk)
                .disabled(isRetrying)
            if imprint.sourceType != .note {
                Button("Open original", systemImage: "arrow.up.right.square", action: openOriginal)
                    .buttonStyle(.bordered)
            }
        }
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
