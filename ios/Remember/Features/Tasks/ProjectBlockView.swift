import SwiftUI

/// Deep work on one project: the ring counts down the whole block, and the project's tasks come one at a
/// time. Done moves straight to the next one, with no win screen in between. Apps stay blocked throughout.
struct ProjectBlockView: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Environment(FocusShield.self) private var shield
    @Environment(\.dismiss) private var dismiss
    let block: ProjectBlock

    @State private var stuckTask: LifeTask?
    @State private var leaveProgress: CGFloat = 0
    @State private var isHoldingLeave = false
    @State private var winCount: Int?
    @State private var doneFeedback = 0
    @State private var isFinishing = false

    private var project: LifeGoal? { store.lifeSnapshot.goals.first { $0.id == block.projectId } }
    private var projectTitle: String { project?.title ?? "Project" }
    private var task: LifeTask? { store.blockTask(for: block.projectId) }
    private var doneCount: Int {
        store.lifeSnapshot.tasks.count {
            $0.goalId == block.projectId && $0.status == .done && ($0.completedAt ?? .distantPast) >= block.startedAt
        }
    }
    private var toGo: Int { max(0, store.availableLifeTasks.count { $0.goalId == block.projectId } - (task?.status == .active ? 0 : 1)) }

    var body: some View {
        ZStack {
            RememberDesign.canvas.ignoresSafeArea()
            if let winCount {
                win(winCount)
            } else {
                content
            }
        }
        .overlay(alignment: .top) {
            ToastHost()
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.top, RememberDesign.spacingSmall)
        }
        .sheet(item: $stuckTask) { StuckSheet(task: $0) }
        .sensoryFeedback(.success, trigger: doneFeedback)
        .onAppear(perform: begin)
        .task(id: task?.id) { await makeCurrent() }
        .statusBarHidden()
    }

    private var content: some View {
        VStack(spacing: 0) {
            HStack {
                Label(shield.isShielding ? "Apps blocked" : "Deep work", systemImage: shield.isShielding ? "lock.fill" : "scope")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                Spacer()
                endButton
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.top, RememberDesign.spacingSmall)

            ScrollView {
                VStack(spacing: RememberDesign.spacingLarge) {
                    VStack(spacing: RememberDesign.spacingSmall) {
                        Text("DEEP WORK · \(projectTitle.uppercased())")
                            .font(.footnote.weight(.bold))
                            .tracking(1.2)
                            .foregroundStyle(RememberDesign.accent)
                        Text(task?.title ?? "\(projectTitle) is clear")
                            .font(.rememberScreenTitle)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .contentTransition(.opacity)
                            .animation(.snappy, value: task?.id)
                        if let task {
                            if !store.firstStep(for: task).isEmpty {
                                Text("Start with: \(store.firstStep(for: task))")
                                    .font(.body)
                                    .foregroundStyle(RememberDesign.text2)
                                    .multilineTextAlignment(.center)
                            }
                            Text("\(doneCount) done · \(toGo) to go")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(RememberDesign.text3)
                        } else {
                            Text("Add what’s next below, or wrap up.")
                                .font(.body)
                                .foregroundStyle(RememberDesign.text2)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .padding(.top, RememberDesign.spacingLarge)

                    ring
                }
                .padding(.horizontal, RememberDesign.spacing)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.immediately)

            VStack(spacing: RememberDesign.spacingSmall) {
                if let task {
                    Button {
                        finish(task)
                    } label: {
                        Label("Done", systemImage: "checkmark")
                    }
                    .buttonStyle(.rememberPrimary)
                    .disabled(isFinishing)
                    .accessibilityIdentifier("remember.block.done")
                    SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                        if context.date >= block.endsAt {
                            wrapUpButton(style: .secondary)
                        } else {
                            Button {
                                stuckTask = task
                            } label: {
                                Label("I’m stuck", systemImage: "hand.raised")
                            }
                            .buttonStyle(.rememberSecondary)
                            .accessibilityIdentifier("remember.block.stuck")
                        }
                    }
                } else {
                    wrapUpButton(style: .primary)
                }
                AddBar.tasks(placeholder: "Add to \(projectTitle)…", focusProjectId: block.projectId)
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingSmall)
        }
    }

    private enum WrapStyle { case primary, secondary }

    @ViewBuilder
    private func wrapUpButton(style: WrapStyle) -> some View {
        let button = Button {
            wrapUp()
        } label: {
            Label("Wrap up", systemImage: "flag.checkered")
        }
        .accessibilityIdentifier("remember.block.wrapUp")
        switch style {
        case .primary: button.buttonStyle(.rememberPrimary)
        case .secondary: button.buttonStyle(.rememberSecondary)
        }
    }

    // MARK: The ring counts down the whole block and can't be paused

    private var ring: some View {
        SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
            let total = TimeInterval(block.minutes * 60)
            let remaining = block.endsAt.timeIntervalSince(context.date)
            let fraction = total > 0 ? min(1, max(0, remaining / total)) : 0
            ZStack {
                Circle().stroke(RememberDesign.cardRaised, lineWidth: 14)
                Circle()
                    .trim(from: 0, to: remaining > 0 ? fraction : 1)
                    .stroke(RememberDesign.accent, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 6) {
                    Text(max(0, remaining).clockLabel)
                        .font(.system(size: 52, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(remaining > 0 ? RememberDesign.text : RememberDesign.accent)
                    Text(remaining > 0 ? "left in this block" : "Block done · finish when ready")
                        .font(.subheadline)
                        .foregroundStyle(remaining > 0 ? RememberDesign.text3 : RememberDesign.accent)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)
            }
            .frame(width: 230, height: 230)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(remaining > 0 ? "\(remaining.spokenElapsed) left in this block" : "Block done")
        }
        .padding(.vertical, RememberDesign.spacing)
    }

    // MARK: End block (press and hold, so leaving is a decision)

    private var endButton: some View {
        Text(isHoldingLeave ? "Keep holding…" : "End block")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(RememberDesign.text3)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background {
                GeometryReader { proxy in
                    Capsule().fill(RememberDesign.cardRaised)
                    Capsule().fill(RememberDesign.line).frame(width: proxy.size.width * leaveProgress)
                }
            }
            .clipShape(.capsule)
            .onLongPressGesture(minimumDuration: 3, maximumDistance: 40) {
                wrapUp()
            } onPressingChanged: { pressing in
                isHoldingLeave = pressing
                withAnimation(pressing ? .linear(duration: 3) : .snappy) { leaveProgress = pressing ? 1 : 0 }
            }
            .accessibilityLabel("End block")
            .accessibilityHint("Press and hold for three seconds")
            .accessibilityAction { wrapUp() }
            .accessibilityIdentifier("remember.block.end")
    }

    // MARK: Lifecycle

    private func begin() {
        // Block apps for the rest of the block, capped a little past its end so nobody is ever stuck.
        let minutesLeft = Int(ceil(block.endsAt.timeIntervalSinceNow / 60))
        if !shield.isShielding, minutesLeft > 0 { shield.begin(minutes: minutesLeft + 10) }
    }

    /// The next task becomes current by itself, and its clock runs so the time spent is saved.
    private func makeCurrent() async {
        guard let task, winCount == nil else { return }
        if !timer.isTracking(task.id) || !timer.isRunning { timer.start(task.id) }
        if task.status != .active { await store.startTask(task) }
    }

    private func finish(_ task: LifeTask) {
        isFinishing = true
        doneFeedback += 1
        let minutes = max(1, timer.minutesSpent(on: task.id))
        timer.reset()
        Task {
            _ = await store.completeTask(task, minutesSpent: minutes)
            isFinishing = false
        }
    }

    /// Ends the block. The current task goes back to the list, then a short win if anything got done.
    private func wrapUp() {
        guard winCount == nil else { return }
        let count = doneCount
        if let task, task.status == .active {
            Task { await store.patchTask(task.id, LifeTaskPatch(status: .queued), quietly: true) }
        }
        timer.reset()
        shield.end()
        guard count > 0 else {
            store.projectBlock = nil
            return
        }
        withAnimation(.snappy) { winCount = count }
        Task {
            try? await Task.sleep(for: .seconds(2))
            store.projectBlock = nil
        }
    }

    private func win(_ count: Int) -> some View {
        VStack(spacing: RememberDesign.spacing) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(RememberDesign.accent)
                .symbolEffect(.bounce, options: .nonRepeating, value: count)
            Text("Deep work done.")
                .font(.rememberScreenTitle)
            Text("\(count) done for \(projectTitle).")
                .font(.title3)
                .foregroundStyle(RememberDesign.text2)
        }
        .sensoryFeedback(.success, trigger: count)
        .transition(.scale.combined(with: .opacity))
        .accessibilityElement(children: .combine)
    }
}
