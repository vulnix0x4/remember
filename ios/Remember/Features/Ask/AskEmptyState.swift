import SwiftUI

struct AskEmptyState: View {
    let selectPrompt: (String) -> Void
    private let prompts = [
        "What themes keep appearing?",
        "Which ideas contradict each other?",
        "What do I seem to believe about success?"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Image(systemName: "sparkles")
                        .font(.largeTitle)
                        .foregroundStyle(RememberDesign.accent)
                        .accessibilityHidden(true)
                    Text("Ask what has shaped you")
                        .font(.largeTitle)
                        .bold()
                    Text("Answers use only your saved material and always point back to their sources.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                SectionHeader(eyebrow: "Try asking", title: "Questions with a memory")
                ForEach(prompts, id: \.self) { prompt in
                    Button { selectPrompt(prompt) } label: {
                        HStack {
                            Text(prompt).multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                    .buttonStyle(.bordered)
                }
                Label("Remember does not use the open web to answer these questions.", systemImage: "lock.shield")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .padding(RememberDesign.spacingLarge)
        }
    }
}
