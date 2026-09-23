import SwiftUI

struct DecisionView: View {
    @Environment(AppStore.self) private var store
    @State private var decision = ""
    @State private var context = ""
    @State private var brief: DecisionBrief?
    @State private var isThinking = false
    @State private var isAdding = false
    @State private var wasAdded = false
    @State private var errorMessage: String?
    @FocusState private var decisionFocused: Bool

    var body: some View {
        ScrollView {
            if let brief {
                result(brief)
            } else {
                composer
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .background(WarmBackground())
        .navigationTitle("Decision")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
        .task { decisionFocused = true }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Image(systemName: "signpost.right.and.left")
                    .font(.title2)
                    .foregroundStyle(RememberDesign.accent)
                    .frame(width: 48, height: 48)
                    .background(RememberDesign.accent.opacity(0.12), in: .rect(cornerRadius: RememberDesign.controlRadius))
                Text("Think through a decision")
                    .font(.largeTitle)
                    .bold()
                Text("Bring your own memory into the choice. Remember will show what fits, what pulls the other way, and what you could test before committing.")
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("What are you deciding?").font(.headline)
                TextField("Should I take the new role?", text: $decision, axis: .vertical)
                    .lineLimit(3...6)
                    .focused($decisionFocused)
                    .textFieldStyle(.plain)
                    .padding(RememberDesign.spacing)
                    .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
                    .accessibilityIdentifier("remember.decision.input")
            }

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                HStack(spacing: 5) {
                    Text("What makes it hard?").font(.headline)
                    Text("Optional").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                }
                TextField("What feels uncertain, costly, or important about it?", text: $context, axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(.plain)
                    .padding(RememberDesign.spacing)
                    .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.danger)
                    .accessibilityIdentifier("remember.decision.error")
            }

            Button(action: think) {
                HStack {
                    Text(isThinking ? "Looking through your saves…" : "Think it through")
                    Spacer()
                    if isThinking { ProgressView().tint(RememberDesign.accentInk) }
                    else { Image(systemName: "arrow.right") }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(RememberDesign.accent)
            .foregroundStyle(RememberDesign.accentInk)
            .disabled(decision.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || isThinking)
            .accessibilityIdentifier("remember.decision.submit")

            Label("Uses only your saved material", systemImage: "lock.shield")
                .font(.footnote)
                .foregroundStyle(RememberDesign.secondaryText)
        }
        .padding(RememberDesign.spacing)
        .padding(.bottom, RememberDesign.spacingXLarge)
    }

    private func result(_ brief: DecisionBrief) -> some View {
        LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            Button("Start over", systemImage: "arrow.left") {
                self.brief = nil
                wasAdded = false
                errorMessage = nil
            }
            .font(.subheadline.bold())

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("Your decision")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.secondaryText)
                Text(brief.decision)
                    .font(.largeTitle)
                    .bold()
                Text(brief.perspective)
                    .font(.title3)
            }

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("What seems to matter")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.secondaryText)
                Text(brief.whatMatters)
                    .font(.title3)
            }
            .padding(.leading, RememberDesign.spacing)
            .overlay(alignment: .leading) { Rectangle().fill(RememberDesign.accent).frame(width: 2) }

            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                decisionPull("What pulls you toward it", brief.pullToward)
                Divider()
                decisionPull("What pulls the other way", brief.pullAgainst)
            }
            .padding(.vertical, RememberDesign.spacingSmall)

            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("A small way to find out")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.secondaryText)
                Text(brief.smallTest)
                    .font(.title3)
                    .bold()
                Button(action: addTest) {
                    Label(wasAdded ? "Added to Plan" : isAdding ? "Adding…" : "Try this", systemImage: wasAdded ? "checkmark" : "arrow.right")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .disabled(isAdding || wasAdded)
                .accessibilityIdentifier("remember.decision.try")
            }
            .rememberSurface()

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("One question worth answering")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.secondaryText)
                Text(brief.nextQuestion)
                    .font(.title3)
                Button("Take this to Ask", systemImage: "bubble.left.and.text.bubble.right") {
                    store.askDraft = brief.nextQuestion
                }
                .buttonStyle(.bordered)
                .tint(RememberDesign.accent)
            }

            if !brief.citations.isEmpty {
                DisclosureGroup("The saves that shaped this") {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(brief.citations) { citation in
                            if let imprint = store.imprint(withID: citation.itemID) {
                                NavigationLink(value: imprint) {
                                    HStack {
                                        Text(citation.title).multilineTextAlignment(.leading)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                    }
                                    .frame(minHeight: 44)
                                }
                                .buttonStyle(.plain)
                                Divider()
                            }
                        }
                    }
                    .padding(.top, RememberDesign.spacingSmall)
                }
                .font(.subheadline.bold())
            }

            if let limitation = brief.limitations.first {
                Text(limitation)
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .padding(RememberDesign.spacing)
        .padding(.bottom, RememberDesign.spacingXLarge)
        .accessibilityIdentifier("remember.decision.result")
    }

    private func decisionPull(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(title).font(.subheadline.bold()).foregroundStyle(RememberDesign.secondaryText)
            Text(text).font(.body)
        }
    }

    private func think() {
        let cleanDecision = decision.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanDecision.count >= 3, !isThinking else { return }
        isThinking = true
        errorMessage = nil
        Task {
            defer { isThinking = false }
            do {
                brief = try await store.thinkThroughDecision(
                    cleanDecision,
                    context: context.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            } catch {
                errorMessage = "Remember could not think this through right now. Try again."
            }
        }
    }

    private func addTest() {
        guard let brief, !isAdding, !wasAdded else { return }
        isAdding = true
        errorMessage = nil
        Task {
            let added = await store.createLifeTask(
                title: String(brief.decision.trimmingCharacters(in: CharacterSet(charactersIn: "?.!")).prefix(180)),
                firstStep: brief.smallTest,
                notes: "A small test for this decision: \(brief.decision)",
                area: .direction,
                duration: 15,
                source: "decision",
                sourceItemId: brief.citations.first?.itemID
            )
            wasAdded = added
            isAdding = false
            if !added { errorMessage = "This test could not be added to Plan. Try again." }
        }
    }
}
