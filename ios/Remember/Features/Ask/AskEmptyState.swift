import SwiftUI

struct AskEmptyState: View {
    let selectPrompt: (String) -> Void
    private let prompts = [
        "What have I saved about focus?",
        "What could help me this week?",
        "Where do my saves disagree?"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                Text("Answers come from your saves.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.text2)

                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    SectionHeading(title: "Try one")
                    ForEach(prompts, id: \.self) { prompt in
                        Button { selectPrompt(prompt) } label: {
                            HStack(spacing: RememberDesign.spacingCompact) {
                                Text(prompt)
                                    .font(.rememberRowTitle)
                                    .foregroundStyle(.white)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(RememberDesign.text3)
                            }
                            .padding(.horizontal, RememberDesign.spacing)
                            .frame(maxWidth: .infinity, minHeight: RememberDesign.rowHeight + 8, alignment: .leading)
                            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                    }
                }

                NavigationLink {
                    DecisionView()
                } label: {
                    Label("Think through a decision", systemImage: "signpost.right.and.left")
                }
                .buttonStyle(.rememberSecondary)
                .accessibilityHint("See what your own saves say before you choose")
                .accessibilityIdentifier("remember.ask.decision")
            }
            .padding(RememberDesign.spacing)
        }
    }
}
