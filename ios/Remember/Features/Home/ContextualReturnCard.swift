import SwiftUI

struct ContextualReturnCard: View {
    let match: ContextualReturn
    let onNotToday: () -> Void
    let onReflectionSaved: () -> Void
    @Environment(AppStore.self) private var store
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var isAdding = false
    @State private var isDismissing = false
    @State private var addedToPlan = false
    @State private var actionFailed = false

    init(match: ContextualReturn, onNotToday: @escaping () -> Void = {}, onReflectionSaved: @escaping () -> Void = {}) {
        self.match = match
        self.onNotToday = onNotToday
        self.onReflectionSaved = onReflectionSaved
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text("For your \(match.contextKind.contextLabel)")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text2)
                .accessibilityIdentifier("remember.today.contextual-return")
            NavigationLink(value: match.imprint) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                    Text(match.imprint.essence)
                        .font(.rememberSectionTitle)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(match.suggestedAction.map { "Try: \($0.title)" } ?? match.contextTitle)
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the saved item")

            if let action = match.suggestedAction {
                Button(action: addedToPlan ? openPlan : { addToPlan(action) }) {
                    Label(addedToPlan ? "Added to Plan" : "Try this today", systemImage: addedToPlan ? "checkmark" : "plus")
                }
                .buttonStyle(.rememberSecondary)
                .disabled(isAdding || isDismissing)
                .accessibilityIdentifier("remember.today.contextual-return.try")
            }

            actionLayout {
                Button("Ask about this", action: exploreInAsk)
                    .buttonStyle(.rememberQuiet)
                    .disabled(isAdding || isDismissing)
                Spacer(minLength: 0)
                Button("Not today", action: dismissForToday)
                    .buttonStyle(.rememberQuiet)
                    .disabled(isAdding || isDismissing)
                    .accessibilityIdentifier("remember.today.contextual-return.not-today")
            }

            if actionFailed {
                Label("That didn’t save. Try again.", systemImage: "exclamationmark.circle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }

            MemoryCheckIn(imprint: match.imprint, onSaved: onReflectionSaved)
                .disabled(isAdding || isDismissing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
    }

    private var actionLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
            : AnyLayout(HStackLayout(spacing: 0))
    }

    private var returnLabel: String {
        switch match.livedResult {
        case .some(.helped): "Helped you before"
        case .some(.mixed): "Worth another try"
        default: "This may be useful now"
        }
    }

    private func exploreInAsk() {
        store.askDraft = match.question
        store.selectedTab = .ask
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }

    private func addToPlan(_ action: ContextualReturnAction) {
        guard !isAdding else { return }
        isAdding = true
        actionFailed = false
        Task {
            let notes = "\(CarryForwardPlan.notes(for: match.imprint))\nConnected to your \(match.contextKind.contextLabel): “\(match.contextTitle)”."
            let saved = await store.createLifeTask(
                title: action.title,
                firstStep: action.firstStep,
                notes: notes,
                area: match.contextArea,
                duration: action.durationMinutes,
                source: "practice",
                sourceItemId: match.imprint.id
            )
            if saved {
                _ = await store.rateContextualReturn(match.imprint, response: .useful)
                addedToPlan = true
                // Keep this card (and its "Added to Plan" state) on screen until the person is done with it.
                onReflectionSaved()
            } else {
                actionFailed = true
            }
            isAdding = false
        }
    }

    private func dismissForToday() {
        guard !isDismissing else { return }
        isDismissing = true
        actionFailed = false
        Task {
            if await store.rateContextualReturn(match.imprint, response: .notToday) {
                onNotToday()
            } else {
                actionFailed = true
            }
            isDismissing = false
        }
    }
}

