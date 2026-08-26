import SwiftUI

struct AskView: View {
    @Environment(AppStore.self) private var store
    @State private var model = AskViewModel()
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                VStack(spacing: 0) {
                    if model.messages.isEmpty {
                        AskEmptyState(selectPrompt: selectPrompt)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: RememberDesign.spacing) {
                                ForEach(model.messages) { message in
                                    AskMessageView(message: message, imprints: store.imprints)
                                }
                                if model.isResponding {
                                    Label("Reading your library…", systemImage: "sparkles")
                                        .font(.subheadline)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                if let title = model.failureTitle, let message = model.failureMessage {
                                    AskFailureView(title: title, message: message) {
                                        Task { await model.retry(using: store) }
                                    }
                                }
                            }
                            .padding(RememberDesign.spacing)
                        }
                    }
                    AskComposer(input: $model.input, isResponding: model.isResponding, submit: submit)
                        .focused($inputFocused)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
        }
    }

    private func selectPrompt(_ prompt: String) {
        model.input = prompt
        submit()
    }

    private func submit() {
        Task { await model.ask(using: store) }
    }
}
