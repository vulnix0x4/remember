import SwiftUI

struct AskComposer: View {
    @Binding var input: String
    let isResponding: Bool
    let submit: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(alignment: .bottom, spacing: RememberDesign.spacingSmall) {
            TextField(dynamicTypeSize.isAccessibilitySize ? "Ask" : "Ask your library", text: $input, axis: .vertical)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 1...3 : 1...4)
                .accessibilityLabel("Ask your library")
                .submitLabel(.send)
                .textFieldStyle(.plain)
                .layoutPriority(1)
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.vertical, 12)
                .background(Color.secondary.opacity(0.12), in: .rect(cornerRadius: 20))
                .onChange(of: input) { _, value in
                    if value.count > AskViewModel.maximumQuestionLength {
                        input = String(value.prefix(AskViewModel.maximumQuestionLength))
                    }
                }
                .onSubmit(submit)
            Button("Ask", systemImage: "arrow.up", action: submit)
                .labelStyle(.iconOnly)
                .font(.headline)
                .foregroundStyle(canSubmit ? RememberDesign.accentInk : RememberDesign.secondaryText)
                .frame(width: 52, height: 52)
                .background(canSubmit ? RememberDesign.accent : RememberDesign.surfaceRaised, in: .circle)
                .overlay {
                    Circle().stroke(RememberDesign.line)
                }
                .buttonStyle(.plain)
                .disabled(!canSubmit)
                .accessibilityIdentifier("remember.ask.submit")
                .accessibilityHint("Searches only your saved material")
        }
        .padding(RememberDesign.spacing)
        .background(.bar)
    }

    private var canSubmit: Bool {
        input.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 && !isResponding
    }
}
