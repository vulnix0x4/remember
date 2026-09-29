import SwiftUI

/// The calm screen instead of the app while phone-free: wind down, sleep time, then the first part of the morning.
struct PhoneFreeView: View {
    @Environment(AppStore.self) private var store
    @Environment(SleepGuard.self) private var sleepGuard
    let night: SleepSession
    let phase: SleepSession.Phase
    let now: Date

    @State private var unlockIsPresented = false
    @State private var cantSleepIsPresented = false
    @State private var checkFeedback = 0
    @State private var upFeedback = 0

    private static let windDownItems = ["Park tomorrow's thoughts", "Phone on the charger, away from bed", "Lights low", "Something calm: shower, read, stretch"]
    private static let morningItems = ["Get daylight: 10 minutes outside or by a window", "Drink a glass of water", "Move a little"]

    var body: some View {
        ZStack {
            (phase == .sleep ? Color.black : RememberDesign.canvas).ignoresSafeArea()
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        header
                        switch phase {
                        case .windDown:
                            checklist(Self.windDownItems)
                        case .sleep:
                            EmptyView()
                        case .morning:
                            if let due = SleepInsights.dueCheckIn(night, metrics: store.lifeSnapshot.health, at: now) {
                                SleepCheckInCard(night: due)
                            }
                            checklist(Self.morningItems)
                            if night.unlocks > 0 {
                                Text(night.unlocks == 1 ? "Last night: 1 unlock" : "Last night: \(night.unlocks) unlocks")
                                    .font(.footnote)
                                    .foregroundStyle(RememberDesign.text3)
                            }
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacingXLarge)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                VStack(spacing: RememberDesign.spacingSmall) {
                    ToastHost()
                    if phase == .sleep {
                        Button {
                            wakeUp()
                        } label: {
                            Label("I'm up", systemImage: "sun.max.fill")
                        }
                        .buttonStyle(.rememberPrimary)
                        .accessibilityIdentifier("remember.phonefree.up")
                        Button("Can't sleep?", systemImage: "moon.zzz") { cantSleepIsPresented = true }
                            .buttonStyle(.rememberSecondary)
                            .accessibilityIdentifier("remember.phonefree.cantSleep")
                    }
                    if phase != .morning {
                        AddBar(placeholder: phase == .windDown ? "Park a thought for tomorrow…" : "Park a thought…",
                               parsesTasks: false, accessibilityIdentifier: "remember.phonefree.park") { text in
                            let saved = await store.quickAddTask(text, parkedUntil: Self.nextMorning(after: .now))
                            if saved { sleepGuard.check(Self.windDownItems[0]) }
                            return saved
                        }
                    }
                    Button("I need my phone") { unlockIsPresented = true }
                        .buttonStyle(.rememberQuiet)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("remember.phonefree.unlock")
                }
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.bottom, RememberDesign.spacingSmall)
            }
            .opacity(phase == .sleep ? 0.85 : 1)
        }
        .sensoryFeedback(.selection, trigger: checkFeedback)
        .sensoryFeedback(.success, trigger: upFeedback)
        .sheet(isPresented: $unlockIsPresented) { UnlockSheet() }
        .sheet(isPresented: $cantSleepIsPresented) { CantSleepSheet() }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Image(systemName: phase == .morning ? "sun.horizon.fill" : "moon.stars.fill")
                .font(.system(size: 34))
                .foregroundStyle(RememberDesign.accent.opacity(phase == .sleep ? 0.6 : 1))
                .accessibilityHidden(true)
            if let eyebrow {
                Text(eyebrow)
                    .font(.rememberEyebrow)
                    .tracking(1.2)
                    .foregroundStyle(RememberDesign.accent)
            }
            Text(title)
                .font(.rememberScreenTitle)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var eyebrow: String? {
        switch phase {
        case .windDown: "WIND DOWN"
        case .sleep: nil
        case .morning: "GOOD MORNING"
        }
    }

    private var title: String {
        switch phase {
        case .windDown: "Lights out around \(night.windDownEnds.formatted(date: .omitted, time: .shortened))"
        case .sleep: "Sleep time"
        case .morning: "Phone-free until \(night.ends.formatted(date: .omitted, time: .shortened))"
        }
    }

    /// Parked thoughts wait for the morning, so nothing lands on the Now card tonight.
    static func nextMorning(after date: Date, calendar: Calendar = .current) -> Date {
        calendar.nextDate(after: date, matching: DateComponents(hour: 6, minute: 0), matchingPolicy: .nextTime) ?? date.addingTimeInterval(8 * 3600)
    }

    private func wakeUp() {
        guard let finished = sleepGuard.wakeUp(), let metric = SleepInsights.savedNight(finished) else { return }
        upFeedback += 1
        Task {
            await store.saveSleepNight(metric, toast: "Good morning") { [sleepGuard] in
                sleepGuard.undoWakeUp()
            }
        }
    }

    private func checklist(_ items: [String]) -> some View {
        VStack(spacing: 0) {
            ForEach(items, id: \.self) { item in
                let done = sleepGuard.isChecked(item)
                Button {
                    checkFeedback += 1
                    withAnimation(.snappy) { sleepGuard.toggle(item) }
                } label: {
                    HStack(spacing: RememberDesign.spacingCompact) {
                        Image(systemName: done ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(done ? RememberDesign.accent : RememberDesign.text3)
                        Text(item)
                            .font(.body)
                            .foregroundStyle(done ? RememberDesign.text3 : RememberDesign.text)
                            .strikethrough(done, color: RememberDesign.text3)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .frame(minHeight: RememberDesign.rowHeight)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(done ? .isSelected : [])
                if item != items.last {
                    Rectangle().fill(RememberDesign.line).frame(height: 0.5).padding(.leading, 52)
                }
            }
        }
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
    }
}

/// "I need my phone": a minute to breathe first, then 15 minutes.
private struct UnlockSheet: View {
    @Environment(SleepGuard.self) private var sleepGuard
    @Environment(\.dismiss) private var dismiss
    @State private var startedAt = Date.now
    private let seconds: TimeInterval = 60

    var body: some View {
        SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
            let left = max(0, seconds - context.date.timeIntervalSince(startedAt))
            VStack(spacing: RememberDesign.spacingLarge) {
                VStack(spacing: RememberDesign.spacingSmall) {
                    Text("Take a breath first")
                        .font(.rememberScreenTitle)
                        .multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                    Text("If you still need it after this, you get 15 minutes.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.text2)
                        .multilineTextAlignment(.center)
                }
                ZStack {
                    Circle().stroke(RememberDesign.cardRaised, lineWidth: 12)
                    Circle()
                        .trim(from: 0, to: left / seconds)
                        .stroke(RememberDesign.accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(Int(left.rounded(.up)))")
                        .font(.system(size: 52, weight: .bold, design: .rounded).monospacedDigit())
                }
                .frame(width: 200, height: 200)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(left > 0 ? "\(Int(left.rounded(.up))) seconds left" : "Done")
                Spacer(minLength: 0)
                if left <= 0 {
                    Button("Unlock for 15 minutes") {
                        sleepGuard.pause()
                        dismiss()
                    }
                    .buttonStyle(.rememberPrimary)
                    .accessibilityIdentifier("remember.phonefree.unlockNow")
                }
                Button("Never mind") { dismiss() }
                    .buttonStyle(.rememberQuiet)
                    .frame(maxWidth: .infinity)
            }
            .padding(RememberDesign.spacing)
            .padding(.top, RememberDesign.spacingXLarge)
        }
        .background(RememberDesign.canvas.ignoresSafeArea())
        .presentationDetents([.large])
        .interactiveDismissDisabled(false)
    }
}

/// What to do at 2 AM when sleep won't come. Stimulus control and slow breathing.
private struct CantSleepSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var isBreathing = false

    private let steps: [(String, String)] = [
        ("Been awake a while? Get up.", "Go somewhere else and keep the lights low."),
        ("Do something boring.", "Read something dull or fold laundry. No screens."),
        ("Go back when you feel sleepy.", "Not before. Your bed is for sleep."),
    ]

    var body: some View {
        Group {
            if isBreathing {
                BreathingView { isBreathing = false }
            } else {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    Text("Can't sleep?")
                        .font(.rememberScreenTitle)
                        .accessibilityAddTraits(.isHeader)
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacingCompact) {
                                Text("\(index + 1)")
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(RememberDesign.accent)
                                    .frame(width: 24, height: 24)
                                    .background(RememberDesign.cardRaised, in: .circle)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(step.0).font(.rememberRowTitle)
                                    Text(step.1).font(.subheadline).foregroundStyle(RememberDesign.text2)
                                }
                                .fixedSize(horizontal: false, vertical: true)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    Spacer(minLength: 0)
                    Button("Breathe with me", systemImage: "wind") { isBreathing = true }
                        .buttonStyle(.rememberPrimary)
                        .accessibilityIdentifier("remember.phonefree.breathe")
                    Button("Close") { dismiss() }
                        .buttonStyle(.rememberQuiet)
                        .frame(maxWidth: .infinity)
                }
                .padding(RememberDesign.spacing)
                .padding(.top, RememberDesign.spacingLarge)
            }
        }
        .background(Color.black.ignoresSafeArea())
        .presentationDetents([.large])
    }
}

/// Two minutes of slow breathing: in for 4 seconds, out for 6.
private struct BreathingView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startedAt = Date.now
    let onFinish: () -> Void

    private let inhale: TimeInterval = 4
    private let exhale: TimeInterval = 6
    private let total: TimeInterval = 120

    var body: some View {
        SwiftUI.TimelineView(.animation(minimumInterval: 1 / 30, paused: false)) { context in
            let elapsed = context.date.timeIntervalSince(startedAt)
            let cycle = elapsed.truncatingRemainder(dividingBy: inhale + exhale)
            let breathingIn = cycle < inhale
            // 0 at empty lungs, 1 at full.
            let fullness = breathingIn ? cycle / inhale : 1 - (cycle - inhale) / exhale
            let eased = 0.5 - cos(fullness * .pi) / 2
            VStack(spacing: RememberDesign.spacingXLarge) {
                Spacer()
                ZStack {
                    Circle()
                        .fill(RememberDesign.accent.opacity(0.18))
                        .frame(width: 260, height: 260)
                        .scaleEffect(reduceMotion ? 1 : 0.45 + 0.55 * eased)
                    Text(elapsed >= total ? "Well done" : breathingIn ? "Breathe in" : "Breathe out")
                        .font(.rememberSectionTitle)
                        .foregroundStyle(RememberDesign.text)
                        .contentTransition(.opacity)
                        .animation(.easeInOut(duration: 0.4), value: breathingIn)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(elapsed >= total ? "Well done" : breathingIn ? "Breathe in" : "Breathe out")
                .accessibilityAddTraits(.updatesFrequently)
                Text(elapsed >= total ? "Back to bed when you feel sleepy." : "\(Int(max(0, total - elapsed) / 60) + 1) min")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text3)
                Spacer()
                Button(elapsed >= total ? "Done" : "Stop", action: onFinish)
                    .buttonStyle(.rememberQuiet)
                    .frame(maxWidth: .infinity)
            }
            .padding(RememberDesign.spacing)
        }
    }
}
