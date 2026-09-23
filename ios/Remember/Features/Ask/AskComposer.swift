import SwiftUI

/// Ask's composer is the screen's white add bar.
struct AskComposer: View {
    @Binding var input: String
    let isResponding: Bool
    let submit: () -> Void

    var body: some View {
        HStack(spacing: RememberDesign.spacingSmall) {
            TextField("", text: $input, prompt: Text("Ask your library…").foregroundStyle(.black.opacity(0.45)), axis: .vertical)
                .font(.body.weight(.medium))
                .foregroundStyle(.black)
                .tint(.black)
                .lineLimit(1...4)
                .accessibilityLabel("Ask your library")
                .submitLabel(.send)
                .onChange(of: input) { _, value in
                    if value.contains("\n") {
                        input = value.replacingOccurrences(of: "\n", with: "")
                        if canSubmit { submit() }
                    } else if value.count > AskViewModel.maximumQuestionLength {
                        input = String(value.prefix(AskViewModel.maximumQuestionLength))
                    }
                }
                .onSubmit { if canSubmit { submit() } }
            Button(action: submit) {
                Group {
                    if isResponding {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "arrow.up").font(.body.weight(.bold))
                    }
                }
                .foregroundStyle(RememberDesign.text)
                .frame(width: 44, height: 44)
                .background(canSubmit || isResponding ? Color.black : Color.black.opacity(0.15), in: .circle)
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .accessibilityLabel("Ask")
            .accessibilityIdentifier("remember.ask.submit")
            .accessibilityHint("Searches only your saved material")
        }
        .padding(.leading, 20)
        .padding(.trailing, 6)
        .frame(minHeight: 56)
        .background(RememberDesign.primaryFill, in: .rect(cornerRadius: 28))
        .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
    }

    private var canSubmit: Bool {
        input.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 && !isResponding
    }
}
