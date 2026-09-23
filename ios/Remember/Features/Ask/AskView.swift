import SwiftUI

struct AskView: View {
    @Environment(AppStore.self) private var store
    @State private var model = AskViewModel()
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                RememberDesign.canvas.ignoresSafeArea()
                VStack(spacing: 0) {
                    RememberHeader("Ask") {
                        if !model.messages.isEmpty || model.failureTitle != nil {
                            Button("New conversation", systemImage: "square.and.pencil", action: startNewConversation)
                                .buttonStyle(.rememberQuiet)
                        }
                    }
                    if model.messages.isEmpty && model.failureTitle == nil {
                        AskEmptyState(selectPrompt: selectPrompt)
                    } else {
                        ScrollViewReader { proxy in
                            ScrollView {
                                LazyVStack(spacing: RememberDesign.spacing) {
                                    ForEach(model.messages) { message in
                                        AskMessageView(message: message, imprints: store.imprints)
                                    }
                                    if model.isResponding {
                                        HStack(spacing: RememberDesign.spacingSmall) {
                                            ProgressView()
                                                .controlSize(.small)
                                                .accessibilityHidden(true)
                                            Text("Checking your saves…")
                                        }
                                        .font(.subheadline)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .accessibilityElement(children: .combine)
                                    }
                                    if let title = model.failureTitle, let message = model.failureMessage {
                                        AskFailureView(title: title, message: message) {
                                            Task { await model.retry(using: store) }
                                        }
                                    }
                                    Color.clear.frame(height: 1).id("ask-bottom")
                                }
                                .padding(RememberDesign.spacing)
                            }
                            .onChange(of: model.messages.count) { scrollToBottom(proxy) }
                            .onChange(of: model.isResponding) { scrollToBottom(proxy) }
                            .onChange(of: model.failureMessage) { scrollToBottom(proxy) }
                        }
                    }
                }
            }
            .rememberBottomDock {
                AskComposer(input: $model.input, isResponding: model.isResponding, submit: submit)
                    .focused($inputFocused)
            }
            .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
            .rememberPrimaryActions()
            .onAppear(perform: performAskHandoff)
            .onChange(of: store.askDraft) { performAskHandoff() }
        }
    }

    private func selectPrompt(_ prompt: String) {
        model.input = prompt
        submit()
    }

    private func submit() {
        Task { await model.ask(using: store) }
    }

    private func startNewConversation() {
        Task { await model.startNewConversation(using: store) }
    }

    private func performAskHandoff() {
        guard let draft = store.askDraft else { return }
        model.input = draft
        store.askDraft = nil
        inputFocused = true
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        proxy.scrollTo("ask-bottom", anchor: .bottom)
    }
}
