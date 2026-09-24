import SwiftUI

/// Where someone is in a guided routine, saved so leaving the app (to move the laundry) never loses it.
struct RoutineProgress: Codable, Equatable {
    var stepIndex = 0
    var waitEndsAt: Date?

    private static func key(_ taskID: UUID) -> String { "remember.routine.\(taskID.uuidString)" }

    static func load(_ taskID: UUID) -> RoutineProgress {
        guard let data = UserDefaults.standard.data(forKey: key(taskID)),
              let progress = try? JSONDecoder().decode(RoutineProgress.self, from: data) else { return RoutineProgress() }
        return progress
    }

    func save(_ taskID: UUID) {
        if let data = try? JSONEncoder().encode(self) { UserDefaults.standard.set(data, forKey: Self.key(taskID)) }
    }

    static func clear(_ taskID: UUID) { UserDefaults.standard.removeObject(forKey: key(taskID)) }
}

/// Full-screen focus on one task: a countdown ring, a short get-ready list, guided steps, and apps blocked.
struct LockInView: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Environment(FocusShield.self) private var shield
    @Environment(Nudges.self) private var nudges
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let task: LifeTask

    @State private var progress = RoutineProgress()
    @State private var ready: Set<String> = []
    @State private var stuckTask: LifeTask?
    @State private var practiceTask: LifeTask?
    @State private var leaveProgress: CGFloat = 0
    @State private var isHoldingLeave = false
    @State private var winCount: Int?
    @State private var stepFeedback = 0

    private var steps: [RoutineStep] { store.lifeSnapshot.commitment(for: task)?.steps ?? [] }
    private var isRoutine: Bool { !steps.isEmpty }
    private var currentStep: RoutineStep? { steps.indices.contains(progress.stepIndex) ? steps[progress.stepIndex] : nil }
    private var targetSeconds: TimeInterval { TimeInterval(task.durationMinutes * 60) }
    private let readyItems = ["Phone face down", "Water nearby", "Close everything else"]

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
        .sheet(item: $practiceTask) { task in
            PracticeResultView(task: task, minutesSpent: timer.minutesSpent(on: task.id), completesTask: true) {
                finishCleanup()
                dismiss()
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: stepFeedback)
        .onAppear(perform: begin)
        .onChange(of: store.lifeSnapshot.tasks.first { $0.id == task.id }?.status) { previous, status in
            // Stuck → "Do something else" or delete moves this task away; leave focus with it.
            if previous == .active, status != .active, winCount == nil { finishCleanup(); dismiss() }
        }
        .statusBarHidden()
    }

    private var content: some View {
        VStack(spacing: 0) {
            HStack {
                Label(shield.isShielding ? "Apps blocked" : "Locked in", systemImage: shield.isShielding ? "lock.fill" : "scope")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                Spacer()
                leaveButton
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.top, RememberDesign.spacingSmall)

            ScrollView {
                VStack(spacing: RememberDesign.spacingLarge) {
                    VStack(spacing: RememberDesign.spacingSmall) {
                        Text(task.title)
                            .font(.rememberScreenTitle)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                        if isRoutine {
                            Text("Step \(min(progress.stepIndex + 1, steps.count)) of \(steps.count)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(RememberDesign.text3)
                        } else if !store.firstStep(for: task).isEmpty {
                            Text("Start with: \(store.firstStep(for: task))")
                                .font(.body)
                                .foregroundStyle(RememberDesign.text2)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .padding(.top, RememberDesign.spacingLarge)

                    if let step = currentStep {
                        routineStep(step)
                    } else {
                        ring
                    }

                    SwiftUI.TimelineView(.periodic(from: .now, by: 5)) { context in
                        if timer.elapsed(for: task.id, at: context.date) < 60 && !isRoutine {
                            getReady
                        }
                    }
                }
                .padding(.horizontal, RememberDesign.spacing)
                .frame(maxWidth: .infinity)
            }

            VStack(spacing: RememberDesign.spacingSmall) {
                if let step = currentStep {
                    SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                        Button(routineButtonTitle(step, at: context.date)) {
                            if step.waitMinutes != nil && progress.waitEndsAt == nil { startWait(step) } else { advanceRoutine() }
                        }
                        .buttonStyle(.rememberPrimary)
                        .accessibilityIdentifier("remember.lockin.nextStep")
                    }
                    .frame(height: RememberDesign.primaryHeight)
                } else {
                    Button {
                        finish()
                    } label: {
                        Label("Done", systemImage: "checkmark")
                    }
                    .buttonStyle(.rememberPrimary)
                    .accessibilityIdentifier("remember.lockin.done")
                }
                Button {
                    stuckTask = store.lifeSnapshot.tasks.first { $0.id == task.id } ?? task
                } label: {
                    Label("I’m stuck", systemImage: "hand.raised")
                }
                .buttonStyle(.rememberSecondary)
                .accessibilityIdentifier("remember.lockin.stuck")
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingSmall)
        }
    }

    // MARK: Countdown ring (time blindness is real)

    private var ring: some View {
        Button {
            timer.toggle(task.id)
        } label: {
            SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                let elapsed = timer.elapsed(for: task.id, at: context.date)
                let remaining = targetSeconds - elapsed
                let fraction = targetSeconds > 0 ? min(1, max(0, remaining / targetSeconds)) : 0
                ZStack {
                    Circle().stroke(RememberDesign.cardRaised, lineWidth: 14)
                    Circle()
                        .trim(from: 0, to: remaining > 0 ? fraction : 1)
                        .stroke(RememberDesign.accent, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 6) {
                        Text(abs(remaining).clockLabel)
                            .font(.system(size: 52, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(remaining > 0 ? RememberDesign.text : RememberDesign.accent)
                        Text(!timer.isRunning ? "Paused · tap to resume" : remaining > 0 ? "left" : "over · keep going")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text3)
                    }
                }
                .frame(width: 230, height: 230)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(remaining > 0 ? "\(abs(remaining).spokenElapsed) left" : "\(abs(remaining).spokenElapsed) over")
                .accessibilityHint(timer.isRunning ? "Pauses the timer" : "Resumes the timer")
            }
        }
        .buttonStyle(.plain)
        .padding(.vertical, RememberDesign.spacing)
    }

    private var getReady: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Get ready")
            ForEach(readyItems, id: \.self) { item in
                let done = ready.contains(item)
                Button {
                    if done { ready.remove(item) } else { ready.insert(item) }
                } label: {
                    HStack(spacing: RememberDesign.spacingCompact) {
                        Image(systemName: done ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(done ? RememberDesign.accent : RememberDesign.text3)
                        Text(item).foregroundStyle(done ? RememberDesign.text3 : RememberDesign.text)
                        Spacer()
                    }
                    .frame(minHeight: 44)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.vertical, RememberDesign.spacingSmall)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .transition(.opacity)
    }

    // MARK: Guided routine

    @ViewBuilder
    private func routineStep(_ step: RoutineStep) -> some View {
        VStack(spacing: RememberDesign.spacing) {
            if let waitEndsAt = progress.waitEndsAt, step.waitMinutes != nil {
                SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                    let left = waitEndsAt.timeIntervalSince(context.date)
                    VStack(spacing: RememberDesign.spacingSmall) {
                        Image(systemName: "hourglass")
                            .font(.system(size: 40))
                            .foregroundStyle(RememberDesign.accent)
                            .symbolEffect(.pulse, isActive: !reduceMotion && left > 0)
                        Text(step.title).font(.rememberHero).multilineTextAlignment(.center)
                        Text(left > 0 ? "\(max(1, Int(ceil(left / 60)))) min left" : "Done. Time for the next step.")
                            .font(.title3.weight(.semibold).monospacedDigit())
                            .foregroundStyle(left > 0 ? RememberDesign.text2 : RememberDesign.accent)
                        Text("You can leave the app. We'll nudge you.")
                            .font(.footnote)
                            .foregroundStyle(RememberDesign.text3)
                    }
                }
            } else {
                Text(step.title)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                if let wait = step.waitMinutes {
                    Text("Once it's going, start the \(wait)-minute timer. We'll nudge you when it's done.")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                        .multilineTextAlignment(.center)
                }
            }
            ProgressView(value: Double(progress.stepIndex), total: Double(max(1, steps.count)))
                .tint(RememberDesign.accent)
                .padding(.top, RememberDesign.spacingSmall)
            if let next = steps.indices.contains(progress.stepIndex + 1) ? steps[progress.stepIndex + 1] : nil {
                Text("Then: \(next.title)")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.text3)
            }
        }
        .padding(RememberDesign.spacingLarge)
        .frame(maxWidth: .infinity)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .padding(.top, RememberDesign.spacing)
    }

    private func routineButtonTitle(_ step: RoutineStep, at date: Date) -> String {
        if let wait = step.waitMinutes {
            guard let ends = progress.waitEndsAt else { return "Start \(wait)-min timer" }
            if ends > date { return "It's done already" }
        }
        return progress.stepIndex == steps.count - 1 ? "Finish" : "Next step"
    }

    private func startWait(_ step: RoutineStep) {
        guard let minutes = step.waitMinutes else { return }
        let ends = Date.now.addingTimeInterval(TimeInterval(minutes * 60))
        progress.waitEndsAt = ends
        progress.save(task.id)
        let next = steps.indices.contains(progress.stepIndex + 1) ? steps[progress.stepIndex + 1].title : nil
        nudges.routineWaitEnds(taskID: task.id, at: ends, finished: step.title.replacingOccurrences(of: " running", with: ""), next: next)
    }

    private func advanceRoutine() {
        stepFeedback += 1
        nudges.cancel(taskID: task.id)
        if progress.stepIndex >= steps.count - 1 {
            finish()
            return
        }
        withAnimation(.snappy) {
            progress.stepIndex += 1
            progress.waitEndsAt = nil
        }
        progress.save(task.id)
    }

    // MARK: Leave (press and hold, so leaving is a decision)

    private var leaveButton: some View {
        Text(isHoldingLeave ? "Keep holding…" : "Leave focus")
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
                leaveFocus()
            } onPressingChanged: { pressing in
                isHoldingLeave = pressing
                withAnimation(pressing ? .linear(duration: 3) : .snappy) { leaveProgress = pressing ? 1 : 0 }
            }
            .accessibilityLabel("Leave focus")
            .accessibilityHint("Press and hold for three seconds")
            .accessibilityAction { leaveFocus() }
    }

    // MARK: Lifecycle

    private func begin() {
        progress = RoutineProgress.load(task.id)
        if !timer.isTracking(task.id) || !timer.isRunning { timer.start(task.id) }
        if !shield.isShielding { shield.begin(minutes: max(task.durationMinutes, shield.defaultMinutes)) }
        let wrapUp = Date.now.addingTimeInterval(targetSeconds - timer.elapsed(for: task.id) - 5 * 60)
        if !isRoutine { nudges.wrapUp(taskID: task.id, title: task.title, at: wrapUp) }
    }

    private func finish() {
        let minutes = timer.minutesSpent(on: task.id)
        if task.source == "practice" {
            practiceTask = task
            return
        }
        let doneToday = store.lifeSnapshot.tasks.count { $0.status == .done && ($0.completedAt.map(Calendar.current.isDateInToday) ?? false) } + 1
        finishCleanup()
        withAnimation(.snappy) { winCount = doneToday }
        Task {
            _ = await store.completeTask(task, minutesSpent: minutes)
            try? await Task.sleep(for: .seconds(2))
            dismiss()
        }
    }

    private func leaveFocus() {
        shield.end()
        nudges.cancel(taskID: task.id)
        dismiss()
    }

    private func finishCleanup() {
        timer.reset()
        shield.end()
        nudges.cancel(taskID: task.id)
        RoutineProgress.clear(task.id)
    }

    private func win(_ count: Int) -> some View {
        VStack(spacing: RememberDesign.spacing) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(RememberDesign.accent)
                .symbolEffect(.bounce, options: .nonRepeating, value: count)
            Text("Done.")
                .font(.rememberScreenTitle)
            Text(count == 1 ? "That's your first today." : "That's \(count) today.")
                .font(.title3)
                .foregroundStyle(RememberDesign.text2)
        }
        .sensoryFeedback(.success, trigger: count)
        .transition(.scale.combined(with: .opacity))
        .accessibilityElement(children: .combine)
    }
}
