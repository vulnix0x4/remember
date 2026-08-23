import SwiftUI

struct AskComposer: View {
    @Binding var input: String
    let isResponding: Bool
    let submit: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: RememberDesign.spacingSmall) {
            TextField("Ask your library", text: $input, axis: .vertical)
                .lineLimit(1...4)
                .textFieldStyle(.plain)
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.vertical, 12)
                .background(Color.secondary.opacity(0.12), in: .rect(cornerRadius: 20))
                .onSubmit(submit)
            Button("Ask", systemImage: "arrow.up", action: submit)
                .labelStyle(.iconOnly)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isResponding)
                .accessibilityHint("Searches only your saved material")
        }
        .padding(RememberDesign.spacing)
        .background(.bar)
    }
}
