import SwiftUI

struct LifeTasksView: View {
    @Environment(AppStore.self) private var store
    @Binding private var planSection: PlanSection
    @State private var presentedSheet: LifeTasksSheet?
    @State private var blockerIsPresented = false
    @State private var switchTaskIsPresented = false
    @State private var removeTaskIsPresented = false
    @State private var practiceToFinish: LifeTask?
    @State private var practiceMinutesSpent = 0
    @State private var completionFeedback = 0
    @State private var expandedTaskID: UUID?
    @State private var basicsAreExpanded = false
    @State private var completedAreExpanded = false
    @State private var isStartingSuggested = false
    @State private var showsSuggestedReason = false
    @SceneStorage("remember.timer.task") private var timerTaskID = ""
    @SceneStorage("remember.timer.started") private var timerStartedTimestamp = 0.0
    @SceneStorage("remember.timer.accumulated") private var timerAccumulatedSeconds = 0.0

    init(planSection: Binding<PlanSection> = .constant(.tasks)) {
        _planSection = planSection
    }

    private var queued: [LifeTask] {
        store.queuedLifeTasks
    }

    private var completed: [LifeTask] {
        store.lifeSnapshot.tasks
            .filter { $0.status == .done }
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
    }

    private var suggestedTask: LifeTask? {
        store.lifeSnapshot.activeTask == nil ? store.suggestedLifeTask : nil
    }

    private var laterTasks: [LifeTask] {
        queued.filter { $0.id != suggestedTask?.id }
    }

    private var runningSince: Date? {
        timerStartedTimestamp > 0 ? Date(timeIntervalSince1970: timerStartedTimestamp) : nil
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $planSection,
                    choices: PlanSection.allCases,
                    accessibilityIdentifier: "remember.section.plan",
                    title: { $0.rawValue }
                )
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    if let active = store.lifeSnapshot.activeTask {
                        activeTaskCard(active)
                    } else if let suggestedTask {
                        suggestedTaskCard(suggestedTask)
                    } else {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            Text(queued.isEmpty ? "Start with one thing" : "You’re clear for now")
                                .font(.title2.bold())
                            Text(queued.isEmpty
                                 ? "Add anything on your mind. You only need a name for it."
                                 : "Your remaining tasks are planned for later. You can bring one forward below.")
                                .font(.body)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
                        .rememberSurface()
                    }

                    if !laterTasks.isEmpty {
                        laterSection
                    }

                    VStack(spacing: 0) {
                        dailyBasicsSection
                        if !completed.isEmpty {
                            Divider()
                                .overlay(RememberDesign.line)
                            completedSection
                        }
                    }
                    .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                    if store.brain != nil {
                        EverydayAutopilotSection()
                    }
                }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, RememberDesign.spacing)
                }
                .refreshable { await store.loadLife() }
            }
            .navigationTitle("Plan")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                TaskQuickAddBar {
                    presentedSheet = .task
                }
            }
            .sheet(item: $presentedSheet) { sheet in
                switch sheet {
                case .task: LifeTaskComposerView()
                case .dailyBasic: LifeFloorComposerView()
                }
            }
            .sheet(item: $practiceToFinish) { task in
                PracticeResultView(
                    task: task,
                    minutesSpent: practiceMinutesSpent,
                    completesTask: true,
                    onSaved: {
                        resetTimer()
                        completionFeedback += 1
                    }
                )
            }
            .sheet(isPresented: $switchTaskIsPresented) { taskSwitcher }
            .confirmationDialog("What would help?", isPresented: $blockerIsPresented, titleVisibility: .visible) {
                Button("Make it smaller") { adaptCurrentTask(.big) }
                Button("Clarify the first step") { adaptCurrentTask(.unclear) }
                Button("I only have five minutes") { adaptCurrentTask(.time) }
                Button("I’m in the wrong place") { adaptCurrentTask(.place) }
                Button("Choose another task") { switchTaskIsPresented = true }
                Button("This task no longer matters", role: .destructive) {
                    removeTaskIsPresented = true
                }
            } message: {
                Text("Adjust this task or switch to another one. Switching keeps this task in your plan.")
            }
            .alert("Remove this task from Plan?", isPresented: $removeTaskIsPresented) {
                Button("Remove task", role: .destructive) { adaptCurrentTask(.irrelevant) }
                Button("Keep task", role: .cancel) {}
            } message: {
                Text("This task will leave your plan. Choose another task if you only want to do something else now.")
            }
            .onChange(of: store.lifeSnapshot.activeTask?.id) { _, taskID in
                guard timerTaskID.isEmpty || timerTaskID == taskID?.uuidString else {
                    resetTimer()
                    return
                }
            }
            .sensoryFeedback(.success, trigger: completionFeedback)
            .rememberPrimaryActions()
        }
    }

    private func activeTaskCard(_ task: LifeTask) -> some View {
        return VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            HStack(alignment: .firstTextBaseline) {
                Text("In progress")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                Spacer()
                Label("\(task.durationMinutes) min", systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(RememberDesign.focusSecondaryText)
            }

            let firstStep = store.firstStep(for: task)
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(task.title)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                if !firstStep.isEmpty {
                    Text("First step")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(RememberDesign.focusSecondaryText)
                    Text(firstStep)
                        .font(.body)
                        .foregroundStyle(.white)
                }
            }
            .padding(RememberDesign.spacingLarge)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))

            if timerTaskID == task.id.uuidString, timerAccumulatedSeconds > 0 || runningSince != nil {
                if let runningSince {
                    SwiftUI.TimelineView(.periodic(from: runningSince, by: 1)) { context in
                        timerLabel(seconds: timerAccumulatedSeconds + context.date.timeIntervalSince(runningSince))
                    }
                } else {
                    timerLabel(seconds: timerAccumulatedSeconds)
                }
            }

            Button {
                toggleTimer(for: task)
            } label: {
                HStack {
                    Image(systemName: runningSince == nil ? "play.fill" : "pause.fill")
                    Text(runningSince == nil ? "Start a focus session" : "Pause focus")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(RememberDesign.accentInk)
                .padding(.horizontal, RememberDesign.spacing)
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(RememberDesign.accent, in: .rect(cornerRadius: RememberDesign.controlRadius))
            }
            .buttonStyle(.plain)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: RememberDesign.spacing) {
                    secondaryActions(for: task)
                }
                VStack(alignment: .leading, spacing: 0) {
                    secondaryActions(for: task)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, RememberDesign.spacingSmall)
        .padding(.vertical, RememberDesign.spacingLarge)
    }

    @ViewBuilder
    private func secondaryActions(for task: LifeTask) -> some View {
        Button(task.source == "practice" ? "Finish experiment" : "Mark done", systemImage: "checkmark") {
            complete(task)
        }
        .foregroundStyle(.white)
        .frame(minHeight: 44)
        Button("Make this easier", systemImage: "questionmark.circle") {
            blockerIsPresented = true
        }
        .foregroundStyle(RememberDesign.focusSecondaryText)
        .frame(minHeight: 44)
        .accessibilityHint("Make the task smaller, clarify it, or choose something else")
    }

    private func suggestedTaskCard(_ task: LifeTask) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            Text(store.brain?.settings.enabled == true
                 && store.brain?.plan.contains(where: { $0.taskId == task.id }) == true
                 ? "Chosen by Jev" : "Next up")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(RememberDesign.accent)
            let firstStep = store.firstStep(for: task)
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(task.title)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                if !firstStep.isEmpty {
                    Text("First step: \(firstStep)")
                        .font(.body)
                        .foregroundStyle(RememberDesign.focusSecondaryText)
                }
            }
            .padding(RememberDesign.spacingLarge)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
            if store.brain?.settings.enabled == true,
               let reason = store.brain?.plan.first(where: { $0.taskId == task.id })?.reason,
               !reason.isEmpty {
                Button(showsSuggestedReason ? "Hide Jev’s reason" : "Why this task?") {
                    withAnimation(.easeInOut(duration: 0.2)) { showsSuggestedReason.toggle() }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(minHeight: 44)
                if showsSuggestedReason {
                    Text(reason)
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.focusSecondaryText)
                }
            }
            Button {
                guard !isStartingSuggested else { return }
                isStartingSuggested = true
                Task {
                    await store.activateLifeTask(task.id)
                    isStartingSuggested = false
                }
            } label: {
                HStack {
                    Text(isStartingSuggested ? "Starting…" : "Do this now")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(RememberDesign.accentInk)
                .padding(.horizontal, RememberDesign.spacing)
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(RememberDesign.accent, in: .rect(cornerRadius: RememberDesign.controlRadius))
            }
            .buttonStyle(.plain)
            .disabled(isStartingSuggested)
        }
        .padding(.horizontal, RememberDesign.spacingSmall)
        .padding(.vertical, RememberDesign.spacingLarge)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var laterSection: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(store.lifeSnapshot.activeTask == nil ? "Other tasks" : "After this")
                .font(.headline)
            Text("Tap a task to see its first step. Start it only when you're ready to switch.")
                .font(.footnote)
                .foregroundStyle(RememberDesign.secondaryText)
            VStack(spacing: 0) {
                ForEach(laterTasks) { task in
                    VStack(alignment: .leading, spacing: 0) {
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                expandedTaskID = expandedTaskID == task.id ? nil : task.id
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "circle")
                                    .foregroundStyle(RememberDesign.tertiaryText)
                                    .frame(width: 24)
                                Text(task.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(.primary)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                                Text("\(task.durationMinutes)m")
                                    .font(.footnote.monospacedDigit())
                                    .foregroundStyle(RememberDesign.secondaryText)
                                Image(systemName: expandedTaskID == task.id ? "chevron.up" : "chevron.down")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(RememberDesign.secondaryText)
                            }
                            .frame(minHeight: 62)
                            .padding(.horizontal, RememberDesign.spacing)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("remember.life-task.\(task.id.uuidString.lowercased())")
                        .accessibilityValue(expandedTaskID == task.id ? "Expanded" : "Collapsed")
                        if expandedTaskID == task.id {
                            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                                if !task.firstStep.isEmpty {
                                    Text("First step: \(task.firstStep)")
                                        .font(.subheadline)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                }
                                if let block = store.brain?.plan.first(where: { $0.taskId == task.id }) {
                                    Text("Jev planned \(block.startAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()))")
                                        .font(.footnote)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                }
                                Button("Do this now", systemImage: "arrow.right") {
                                    Task { await store.activateLifeTask(task.id) }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(RememberDesign.accent)
                                .foregroundStyle(RememberDesign.accentInk)
                                .frame(minHeight: 44)
                            }
                            .padding(.leading, 52)
                            .padding(.trailing, RememberDesign.spacing)
                            .padding(.bottom, RememberDesign.spacing)
                        }
                    }
                    if task.id != laterTasks.last?.id {
                        Divider().padding(.leading, 52)
                    }
                }
            }
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        }
    }

    private var dailyBasicsSection: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { basicsAreExpanded.toggle() }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Daily basics").font(.headline).foregroundStyle(.primary)
                        if !store.lifeSnapshot.floor.isEmpty {
                            Text("\(store.lifeSnapshot.floor.count { item in item.completionDates.contains { Calendar.current.isDateInToday($0) } }) of \(store.lifeSnapshot.floor.count) done")
                                .font(.footnote)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                    }
                    Spacer()
                    Image(systemName: basicsAreExpanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                .frame(minHeight: 54)
            }
            .buttonStyle(.plain)
            .accessibilityValue(basicsAreExpanded ? "Expanded" : "Collapsed")
            if basicsAreExpanded {
                Button("Add a daily basic", systemImage: "plus") { presentedSheet = .dailyBasic }
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
                if store.lifeSnapshot.floor.isEmpty {
                    Text("These are optional. Start with one small routine.")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.secondaryText)
                } else {
                VStack(spacing: 0) {
                    ForEach(store.lifeSnapshot.floor) { item in
                        let isComplete = item.completionDates.contains { Calendar.current.isDateInToday($0) }
                        Button {
                            Task { await store.toggleLifeFloorItem(item.id) }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(isComplete ? RememberDesign.accent : RememberDesign.tertiaryText)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)
                                    Text("\(item.target) \(item.unit) · \(item.area.label)")
                                        .font(.caption)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                }
                                Spacer()
                            }
                            .frame(minHeight: 56)
                            .padding(.horizontal, RememberDesign.spacing)
                        }
                        .buttonStyle(.plain)
                        .accessibilityValue(isComplete ? "Done today" : "Not done today")
                        if item.id != store.lifeSnapshot.floor.last?.id {
                            Divider().padding(.leading, 52)
                        }
                    }
                }
                .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                }
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.vertical, RememberDesign.spacingSmall)
    }

    private var completedSection: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { completedAreExpanded.toggle() }
            } label: {
                HStack {
                    Text("Completed").font(.headline).foregroundStyle(.primary)
                    Text("\(completed.count)").font(.footnote).foregroundStyle(RememberDesign.secondaryText)
                    Spacer()
                    Image(systemName: completedAreExpanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            if completedAreExpanded {
                ForEach(completed.prefix(6)) { task in
                    Label(task.title, systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.secondaryText)
                        .frame(minHeight: 44)
                }
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.vertical, RememberDesign.spacingSmall)
    }

    private var taskSwitcher: some View {
        NavigationStack {
            Group {
                if queued.isEmpty {
                    ContentUnavailableView(
                        "No other tasks yet",
                        systemImage: "checklist",
                        description: Text("Close this and add a task using the bar at the bottom of Plan.")
                    )
                } else {
                    List(queued) { task in
                        Button {
                            switchTaskIsPresented = false
                            Task {
                                await store.activateLifeTask(task.id)
                                if store.lifeSnapshot.activeTask?.id == task.id {
                                    resetTimer()
                                }
                            }
                        } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(task.title)
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(.primary)
                                    let firstStep = store.firstStep(for: task)
                                    if !firstStep.isEmpty {
                                        Text(firstStep)
                                            .font(.subheadline)
                                            .foregroundStyle(RememberDesign.secondaryText)
                                    }
                                }
                                Spacer()
                                Text("Do now")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(RememberDesign.accent)
                            }
                            .frame(minHeight: 56)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Choose another task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { switchTaskIsPresented = false }
                }
            }
        }
    }

    private func adaptCurrentTask(_ reason: LifeBlockerReason) {
        guard let active = store.lifeSnapshot.activeTask else { return }
        Task {
            if await store.blockLifeTask(active.id, reason: reason) {
                resetTimer()
            }
        }
    }

    private func timerLabel(seconds: TimeInterval) -> some View {
        Label(seconds.formattedElapsed, systemImage: "timer")
            .font(.title2.monospacedDigit().bold())
            .foregroundStyle(.white)
            .accessibilityLabel("Focus timer")
            .accessibilityValue(seconds.spokenElapsed)
    }

    private func timerActionTitle(for task: LifeTask) -> String {
        if runningSince != nil { return "Pause" }
        if timerTaskID == task.id.uuidString, timerAccumulatedSeconds > 0 { return "Resume" }
        return "Start"
    }

    private func toggleTimer(for task: LifeTask) {
        if timerTaskID != task.id.uuidString {
            resetTimer()
            timerTaskID = task.id.uuidString
        }
        if let runningSince {
            timerAccumulatedSeconds += Date.now.timeIntervalSince(runningSince)
            timerStartedTimestamp = 0
        } else {
            timerStartedTimestamp = Date.now.timeIntervalSince1970
        }
    }

    private func complete(_ task: LifeTask) {
        var elapsed = timerAccumulatedSeconds
        if let runningSince {
            elapsed += Date.now.timeIntervalSince(runningSince)
        }
        let minutesSpent = max(0, Int((elapsed / 60).rounded()))
        if task.source == "practice" {
            practiceMinutesSpent = minutesSpent
            practiceToFinish = task
            return
        }
        Task {
            if await store.completeLifeTask(task.id, minutesSpent: minutesSpent) {
                resetTimer()
                completionFeedback += 1
            }
        }
    }

    private func resetTimer() {
        timerTaskID = ""
        timerStartedTimestamp = 0
        timerAccumulatedSeconds = 0
    }
}

private extension TimeInterval {
    var formattedElapsed: String {
        let totalSeconds = max(0, Int(self))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return "\(minutes.formatted(.number.precision(.integerLength(2)))):\(seconds.formatted(.number.precision(.integerLength(2))))"
    }

    var spokenElapsed: String {
        let totalSeconds = max(0, Int(self))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        if minutes == 0 {
            return "\(seconds) \(seconds == 1 ? "second" : "seconds")"
        }
        if seconds == 0 {
            return "\(minutes) \(minutes == 1 ? "minute" : "minutes")"
        }
        return "\(minutes) \(minutes == 1 ? "minute" : "minutes"), \(seconds) \(seconds == 1 ? "second" : "seconds")"
    }
}
