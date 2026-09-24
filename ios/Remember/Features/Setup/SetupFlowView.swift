import SwiftUI

/// Remembers whether first-run setup has been finished or skipped.
enum SetupProgress {
    private static let key = "remember.setup.completed.v1"
    static var isComplete: Bool { UserDefaults.standard.bool(forKey: key) }
    static func complete() { UserDefaults.standard.set(true, forKey: key) }
    static func reset() { UserDefaults.standard.set(false, forKey: key) }
}

/// First-run setup: the same sections as Settings, one calm step at a time.
struct SetupFlowView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var step = Step.welcome

    private enum Step: Int, CaseIterable {
        case welcome, day, commitments, chores, focus, nudges, done
    }

    var body: some View {
        VStack(spacing: 0) {
            if step != .welcome && step != .done {
                ProgressView(value: Double(step.rawValue), total: Double(Step.done.rawValue))
                    .tint(RememberDesign.accent)
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacing)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    header
                    content
                }
                .padding(RememberDesign.spacing)
                .padding(.top, RememberDesign.spacingLarge)
                .id(step)
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
            }
            .scrollDismissesKeyboard(.interactively)
            VStack(spacing: RememberDesign.spacingXXSmall) {
                Button(primaryTitle, action: advance)
                    .buttonStyle(.rememberPrimary)
                    .accessibilityIdentifier("remember.setup.next")
                if step != .welcome && step != .done {
                    Button("Skip", action: advance)
                        .buttonStyle(.rememberQuiet)
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingSmall)
        }
        .background(RememberDesign.canvas.ignoresSafeArea())
        .overlay(alignment: .bottom) { ToastHost().padding(.bottom, 120).padding(.horizontal, RememberDesign.spacing) }
        .animation(.snappy, value: step)
        .interactiveDismissDisabled()
    }

    private var primaryTitle: String {
        switch step {
        case .welcome: "Let's set up your day"
        case .done: "Show me my day"
        default: "Next"
        }
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(title)
                .font(.rememberScreenTitle)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle)
                .font(.body)
                .foregroundStyle(RememberDesign.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var title: String {
        switch step {
        case .welcome: "Let's take the thinking out of your day"
        case .day: "When is your day?"
        case .commitments: "What do you do most days?"
        case .chores: "What keeps life running?"
        case .focus: "Stay locked in"
        case .nudges: "A gentle tap when it's time"
        case .done: "Jev is planning your day"
        }
    }

    private var subtitle: String {
        switch step {
        case .welcome: "Tell Remember what your life looks like once. Jev decides what to do and when, so you don't have to."
        case .day: "Jev only plans inside these hours."
        case .commitments: "Like college or the gym. Jev fits them in every day, around everything else."
        case .chores: "They repeat on their own. Laundry walks you through each step."
        case .focus: "When you start a task, Remember can block distracting apps until you're done."
        case .nudges: "Only for the next thing, a 5-minute wrap-up, and the washer finishing. Never repeated."
        case .done: "You can change any of this later in Settings."
        }
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .welcome:
            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                bullet("sparkles", "Jev picks the one thing to do next")
                bullet("repeat", "Chores and routines come back by themselves")
                bullet("lock", "Start a task and everything else goes quiet")
            }
        case .day: YourDaySection()
        case .commitments: CommitmentsSection(kind: .commitment)
        case .chores: CommitmentsSection(kind: .chore)
        case .focus: FocusModeSection()
        case .nudges: NudgesSection()
        case .done:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(RememberDesign.accent)
                .frame(maxWidth: .infinity)
                .padding(.top, RememberDesign.spacingXLarge)
                .symbolEffect(.bounce, value: step)
        }
    }

    private func bullet(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: RememberDesign.spacingCompact) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(RememberDesign.accent)
                .frame(width: 44, height: 44)
                .background(RememberDesign.card, in: .circle)
            Text(text).font(.body.weight(.medium))
        }
    }

    private func advance() {
        guard let next = Step(rawValue: step.rawValue + 1) else {
            SetupProgress.complete()
            store.selectedTab = .home
            Task { await store.refreshBrain() }
            dismiss()
            return
        }
        step = next
    }
}
