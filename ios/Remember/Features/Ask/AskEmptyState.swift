import SwiftUI

struct AskEmptyState: View {
    let selectPrompt: (String) -> Void
    private let prompts = [
        "What have I saved about focus?",
        "What could help me this week?",
        "Where do my saved sources disagree?"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("Ask about your saves")
                        .font(.title2)
                        .bold()
                    Text("Answers use your saved material and link back to supporting sources.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                NavigationLink {
                    DecisionView()
                } label: {
                    HStack(spacing: RememberDesign.spacingCompact) {
                        Image(systemName: "signpost.right.and.left")
                            .font(.title3)
                            .foregroundStyle(RememberDesign.accent)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Think through a decision")
                                .font(.headline)
                            Text("See what your own memory says before you choose.")
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                }
                .buttonStyle(.plain)
                .padding(RememberDesign.spacing)
                .background(RememberDesign.accent.opacity(0.10), in: .rect(cornerRadius: RememberDesign.cornerRadius))
                .overlay { RoundedRectangle(cornerRadius: RememberDesign.cornerRadius).stroke(RememberDesign.accent.opacity(0.45)) }
                .accessibilityIdentifier("remember.ask.decision")
                SectionHeader(eyebrow: "", title: "Try a question")
                ForEach(prompts, id: \.self) { prompt in
                    Button { selectPrompt(prompt) } label: {
                        HStack {
                            Text(prompt).multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .rememberSurface()
                }
                Label("Answers only use your saves.", systemImage: "lock.shield")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .padding(RememberDesign.spacing)
        }
    }
}
