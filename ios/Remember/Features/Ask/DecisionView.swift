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
        .background(RememberDesign.canvas)
        .rememberBottomDock()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(RememberDesign.canvas, for: .navigationBar)
        .navigationDestination(for: Imprint.self) { ImprintDetailView(imprint: $0) }
        .task { decisionFocused = true }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            Text("Think it through")
                .font(.rememberScreenTitle)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("remember.decision.title")

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "What are you deciding?")
                TextField("Should I take the new role?", text: $decision, axis: .vertical)
                    .font(.title3.weight(.semibold))
                    .lineLimit(2...6)
                    .focused($decisionFocused)
                    .textFieldStyle(.plain)
                    .padding(RememberDesign.spacing + 4)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                    .accessibilityIdentifier("remember.decision.input")
            }

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "What makes it hard?", trailing: "Optional")
                TextField("Cost, risk, what matters…", text: $context, axis: .vertical)
                    .lineLimit(2...6)
                    .textFieldStyle(.plain)
                    .padding(RememberDesign.spacing + 4)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RememberDesign.danger)
                    .accessibilityIdentifier("remember.decision.error")
            }

            Button(action: think) {
                if isThinking {
                    HStack(spacing: RememberDesign.spacingSmall) {
                        ProgressView().tint(RememberDesign.canvas)
                        Text("Reading your saves…")
                    }
                } else {
                    Text("Think it through")
                }
            }
            .buttonStyle(.rememberPrimary)
            .disabled(decision.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || isThinking)
            .accessibilityIdentifier("remember.decision.submit")

            Label("Uses only your saves", systemImage: "lock.fill")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text3)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.bottom, RememberDesign.spacingXLarge)
    }

    private func result(_ brief: DecisionBrief) -> some View {
        LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(brief.decision)
                    .font(.rememberHero)
                    .fixedSize(horizontal: false, vertical: true)
                Text(brief.perspective)
                    .font(.body)
                    .foregroundStyle(RememberDesign.text2)
            }

            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                Text("A small way to find out")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text2)
                Text(brief.smallTest)
                    .font(.rememberSectionTitle)
                    .fixedSize(horizontal: false, vertical: true)
                Button(action: addTest) {
                    Label(wasAdded ? "Added to Plan" : isAdding ? "Adding…" : "Try this", systemImage: wasAdded ? "checkmark" : "plus")
                }
                .buttonStyle(.rememberPrimary)
                .disabled(isAdding || wasAdded)
                .accessibilityIdentifier("remember.decision.try")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing + 4)

            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                decisionPull("What seems to matter", brief.whatMatters)
                Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                decisionPull("What pulls you toward it", brief.pullToward)
                Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                decisionPull("What pulls the other way", brief.pullAgainst)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing)

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                decisionPull("One question worth answering", brief.nextQuestion)
                Button("Take this to Ask", systemImage: "bubble.left.and.text.bubble.right") {
                    store.askDraft = brief.nextQuestion
                }
                .buttonStyle(.rememberSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing)

            if !brief.citations.isEmpty {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    SectionHeading(title: "Saves that shaped this")
                    ForEach(brief.citations) { citation in
                        if let imprint = store.imprint(withID: citation.itemID) {
                            NavigationLink(value: imprint) {
                                HStack {
                                    Text(citation.title)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(RememberDesign.text)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.footnote.weight(.bold))
                                        .foregroundStyle(RememberDesign.text3)
                                }
                                .padding(.horizontal, RememberDesign.spacing)
                                .frame(minHeight: RememberDesign.rowHeight)
                                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                                .contentShape(.rect)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            if let limitation = brief.limitations.first {
                Text(limitation)
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text3)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RememberDesign.danger)
            }

            Button("Start over", systemImage: "arrow.counterclockwise") {
                self.brief = nil
                wasAdded = false
                errorMessage = nil
            }
            .buttonStyle(.rememberQuiet)
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.bottom, RememberDesign.spacingXLarge)
        .accessibilityIdentifier("remember.decision.result")
    }

    private func decisionPull(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
            Text(title).font(.rememberMeta).foregroundStyle(RememberDesign.text2)
            Text(text).font(.body).fixedSize(horizontal: false, vertical: true)
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
                errorMessage = "Couldn’t think this through. Try again."
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
            if !added { errorMessage = "Couldn’t add that. Try again." }
        }
    }
}
