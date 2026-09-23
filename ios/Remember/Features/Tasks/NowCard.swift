import SwiftUI

/// The hero on Today and Plan: the one thing to do right now.
struct NowCard: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var compact = false

    @State private var stuckTask: LifeTask?
    @State private var practiceTask: LifeTask?
    @State private var practiceMinutes = 0
    @State private var reasonIsExpanded = false
    @State private var isWorking = false
    @State private var startFeedback = 0
    @State private var doneFeedback = 0

    private var active: LifeTask? { store.lifeSnapshot.activeTask }
    private var suggested: LifeTask? { active ?? store.suggestedLifeTask }

    var body: some View {
        Group {
            // A task is only "Doing" once the person taps Start. If the server or Jev made it current,
            // it is offered as "Now" so nothing starts without their say.
            if let active, timer.isTracking(active.id) {
                doing(active)
            } else if let suggested {
                next(suggested)
            } else if !compact {
                empty
            }
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: startFeedback)
        .sensoryFeedback(.success, trigger: doneFeedback)
        .sheet(item: $stuckTask) { task in
            StuckSheet(task: task)
        }
        .sheet(item: $practiceTask) { task in
            PracticeResultView(task: task, minutesSpent: practiceMinutes, completesTask: true) {
                timer.reset()
                doneFeedback += 1
            }
        }
    }

    // MARK: Not started

    private func next(_ task: LifeTask) -> some View {
        VStack(alignment: .leading, spacing: compact ? RememberDesign.spacingCompact : RememberDesign.spacing) {
            eyebrow("NOW", pulsing: false)
            titleBlock(task)
            if !compact, let reason = jevReason(for: task) {
                Button {
                    withAnimation(.snappy) { reasonIsExpanded.toggle() }
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "sparkle")
                            .font(.caption)
                            .foregroundStyle(RememberDesign.accent)
                        Text(reason)
                            .font(.subheadline)
                            .italic()
                            .foregroundStyle(RememberDesign.text3)
                            .lineLimit(reasonIsExpanded ? nil : 2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Why Jev picked this: \(reason)")
            }
            Button {
                start(task)
            } label: {
                Label(isWorking ? "Starting…" : "Start", systemImage: "play.fill")
            }
            .buttonStyle(.rememberPrimary)
            .disabled(isWorking)
            .accessibilityIdentifier("remember.now.start")
            if !compact {
                Button("Not now") {
                    Task { await store.setTaskAside(task) }
                }
                .buttonStyle(.rememberQuiet)
                .frame(maxWidth: .infinity)
                .accessibilityHint("Moves this aside for an hour. Jev picks something else.")
                .accessibilityIdentifier("remember.now.notNow")
            }
        }
        .rememberCard(padding: compact ? RememberDesign.spacing : RememberDesign.spacingLarge)
    }

    // MARK: Doing

    private func doing(_ task: LifeTask) -> some View {
        VStack(alignment: .leading, spacing: compact ? RememberDesign.spacingCompact : RememberDesign.spacing) {
            HStack {
                eyebrow("DOING", pulsing: true)
                Spacer()
                timerButton(task)
            }
            titleBlock(task)
            Button {
                finish(task)
            } label: {
                Label("Done", systemImage: "checkmark")
            }
            .buttonStyle(.rememberPrimary)
            .accessibilityIdentifier("remember.now.done")
            Button {
                stuckTask = task
            } label: {
                Label("I’m stuck", systemImage: "hand.raised")
            }
            .buttonStyle(.rememberSecondary)
            .accessibilityHint("Make it smaller, get a first step, or switch to something else")
            .accessibilityIdentifier("remember.now.stuck")
        }
        .rememberCard(padding: compact ? RememberDesign.spacing : RememberDesign.spacingLarge)
        .overlay {
            RoundedRectangle(cornerRadius: RememberDesign.cornerRadius)
                .strokeBorder(RememberDesign.accent.opacity(0.5), lineWidth: 1.5)
        }
    }

    private func timerButton(_ task: LifeTask) -> some View {
        Button {
            timer.toggle(task.id)
        } label: {
            SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                HStack(spacing: 6) {
                    Image(systemName: timer.isRunning && timer.isTracking(task.id) ? "pause.fill" : "play.fill")
                        .font(.caption.weight(.bold))
                    Text(timer.elapsed(for: task.id, at: context.date).clockLabel)
                        .font(.system(compact ? .headline : .title2, design: .rounded).monospacedDigit().weight(.bold))
                }
                .foregroundStyle(RememberDesign.accent)
                .padding(.horizontal, 12)
                .frame(minHeight: 40)
                .background(RememberDesign.accent.opacity(0.14), in: .capsule)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(timer.isRunning ? "Pause timer" : "Resume timer")
        .accessibilityValue(timer.elapsed(for: task.id).spokenElapsed)
    }

    // MARK: Empty

    @ViewBuilder
    private var empty: some View {
        let waiting = store.queuedLifeTasks
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            if waiting.isEmpty {
                Text("What’s on your mind?")
                    .font(.rememberHero)
                Text("Add anything below. Jev will plan it.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.text2)
            } else {
                Text(clearUntilTitle(waiting))
                    .font(.rememberHero)
                Text("Nothing needs you right now.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.text2)
                Button("Pull one forward") { store.selectedTab = .tasks }
                    .buttonStyle(.rememberSecondary)
                    .padding(.top, RememberDesign.spacingSmall)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard()
    }

    // MARK: Pieces

    private func eyebrow(_ text: String, pulsing: Bool) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(RememberDesign.accent)
                .frame(width: 8, height: 8)
                .phaseAnimator([1.0, 0.3]) { dot, opacity in
                    dot.opacity(pulsing && !reduceMotion ? opacity : 1)
                } animation: { _ in .easeInOut(duration: 0.9) }
            Text(text)
                .font(.rememberEyebrow)
                .tracking(1.2)
                .foregroundStyle(RememberDesign.accent)
        }
        .accessibilityElement(children: .combine)
    }

    private func titleBlock(_ task: LifeTask) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(task.title)
                .font(compact ? .rememberSectionTitle : .rememberHero)
                .fixedSize(horizontal: false, vertical: true)
            let firstStep = store.firstStep(for: task)
            if !firstStep.isEmpty, !compact {
                Text("Start with: \(firstStep)")
                    .font(.body)
                    .foregroundStyle(RememberDesign.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !compact {
                HStack(spacing: 6) {
                    MetaChip(text: task.durationMinutes.durationLabel, systemImage: "timer")
                    if let days = task.repeatEveryDays { MetaChip(text: days.repeatLabel, systemImage: "repeat") }
                    if let due = task.dueAt { MetaChip(text: "Due \(due.relativeDayLabel)", systemImage: "flag") }
                }
            }
        }
    }

    private func jevReason(for task: LifeTask) -> String? {
        guard store.brain?.settings.enabled == true,
              let reason = store.brain?.plan.first(where: { $0.taskId == task.id })?.reason,
              !reason.isEmpty else { return nil }
        return reason
    }

    private func clearUntilTitle(_ waiting: [LifeTask]) -> String {
        let next = waiting.compactMap { task in [task.notBefore, task.scheduledStart].compactMap { $0 }.max() }
            .filter { $0 > .now }
            .min()
        guard let next else { return "You’re clear for now" }
        return Calendar.current.isDateInToday(next)
            ? "You’re clear until \(next.formatted(date: .omitted, time: .shortened))"
            : "You’re clear for today"
    }

    private func start(_ task: LifeTask) {
        guard !isWorking else { return }
        isWorking = true
        startFeedback += 1
        timer.start(task.id)
        Task {
            if task.status != .active { await store.startTask(task) }
            isWorking = false
        }
    }

    private func finish(_ task: LifeTask) {
        let minutes = timer.minutesSpent(on: task.id)
        if task.source == "practice" {
            practiceMinutes = minutes
            practiceTask = task
            return
        }
        doneFeedback += 1
        timer.reset()
        Task { _ = await store.completeTask(task, minutesSpent: minutes) }
    }
}
