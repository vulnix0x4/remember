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
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("For your \(match.contextKind.contextLabel)")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.accent)
                    .accessibilityIdentifier("remember.today.contextual-return")
                Text(match.contextTitle)
                    .font(.title2.bold())
                if let contextDetail = match.contextDetail {
                    Text(contextDetail)
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                Text("Connected through \(match.connection)")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            Divider()

            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(returnLabel)
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.accent)
                Text(match.imprint.essence)
                    .font(.title3.bold())
                Text(match.reason)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
                Label(match.imprint.title, systemImage: "books.vertical")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            if let action = match.suggestedAction {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("One move for today")
                        .font(.subheadline.bold())
                        .foregroundStyle(RememberDesign.accent)
                    Text(action.title)
                        .font(.headline)
                    Text("\(action.durationMinutes) minutes, carried into Plan with its source")
                        .font(.caption)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
            }

            VStack(spacing: RememberDesign.spacingSmall) {
                if let action = match.suggestedAction {
                    Button(action: addedToPlan ? openPlan : { addToPlan(action) }) {
                        Label(addedToPlan ? "Added to Plan" : "Try this today", systemImage: addedToPlan ? "checkmark" : "arrow.right")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.accentInk)
                    .disabled(isAdding || isDismissing)
                    .accessibilityIdentifier("remember.today.contextual-return.try")
                }

                Button("Ask about this", systemImage: "bubble.left.and.text.bubble.right", action: exploreInAsk)
                    .buttonStyle(.bordered)
                    .tint(RememberDesign.accent)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(isAdding || isDismissing)
            }
            .buttonBorderShape(.roundedRectangle(radius: RememberDesign.controlRadius))

            if actionFailed {
                Label("That did not save. Please try again.", systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            MemoryCheckIn(imprint: match.imprint, onSaved: onReflectionSaved)
                .disabled(isAdding || isDismissing)

            actionLayout {
                NavigationLink(value: match.imprint) {
                    Text("Open saved item")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(RememberDesign.accent)

                Button("Not for today", action: dismissForToday)
                    .buttonStyle(.plain)
                    .foregroundStyle(RememberDesign.secondaryText)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(isAdding || isDismissing)
                    .accessibilityIdentifier("remember.today.contextual-return.not-today")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberSurface()
    }

    private var actionLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: RememberDesign.spacingSmall))
            : AnyLayout(HStackLayout(spacing: RememberDesign.spacingSmall))
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

