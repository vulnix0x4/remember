import SwiftUI

/// Plan → Tasks: what's now, what's today, what's later. Tap a circle to finish; tap a row to change it.
struct LifeTasksView: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Binding private var planSection: PlanSection
    @State private var openTask: LifeTask?
    @State private var doneIsExpanded = false
    @State private var isAddingBasic = false

    init(planSection: Binding<PlanSection> = .constant(.tasks)) {
        _planSection = planSection
    }

    private var currentID: UUID? {
        store.lifeSnapshot.activeTask?.id ?? store.suggestedLifeTask?.id
    }

    private func startDate(_ task: LifeTask) -> Date? {
        [task.notBefore, task.scheduledStart].compactMap { $0 }.max()
    }

    private var todayTasks: [LifeTask] {
        store.queuedLifeTasks.filter { task in
            task.id != currentID && (startDate(task).map { $0 <= .now || Calendar.current.isDateInToday($0) } ?? true)
        }
    }

    private var laterTasks: [LifeTask] {
        store.queuedLifeTasks
            .filter { task in task.id != currentID && startDate(task).map { $0 > .now && !Calendar.current.isDateInToday($0) } ?? false }
            .sorted { (startDate($0) ?? .distantFuture) < (startDate($1) ?? .distantFuture) }
    }

    private var doneToday: [LifeTask] {
        store.lifeSnapshot.tasks
            .filter { $0.status == .done && ($0.completedAt.map(Calendar.current.isDateInToday) ?? false) }
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
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
                // The Now card sits above the list: sheets presented from inside List rows don't appear.
                NowCard(compact: true)
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.vertical, RememberDesign.spacingSmall)
                List {
                    if !todayTasks.isEmpty {
                        taskSection("Today", tasks: todayTasks, trailing: totalTime(todayTasks))
                    }
                    if !laterTasks.isEmpty {
                        taskSection("Later", tasks: laterTasks)
                    }
                    if currentID == nil && todayTasks.isEmpty && laterTasks.isEmpty {
                        Section {
                            RememberEmptyState(
                                systemImage: "checklist",
                                title: "Nothing planned",
                                message: "Type anything in the bar below. “Call mom tomorrow 15m” works."
                            )
                            .listRowBackground(Color.clear)
                        }
                    }
                    Section {
                        DailyBasicsStrip { isAddingBasic = true }
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                    }
                    if !doneToday.isEmpty { doneSection }
                }
                .listStyle(.insetGrouped)
                .listSectionSpacing(RememberDesign.spacingLarge)
                .environment(\.defaultMinListRowHeight, 44)
                .scrollContentBackground(.hidden)
                .scrollDismissesKeyboard(.immediately)
                .refreshable { await store.loadLife() }
            }
            .rememberBottomDock {
                AddBar(placeholder: "Add a task…", parsesTasks: true, accessibilityIdentifier: "remember.task.quickAdd") {
                    await store.quickAddTask($0)
                }
            }
            .sheet(item: $openTask) { TaskEditorSheet(task: $0) }
            .sheet(isPresented: $isAddingBasic) { LifeFloorComposerView() }
            .rememberPrimaryActions()
        }
    }

    private func taskSection(_ title: String, tasks: [LifeTask], trailing: String? = nil) -> some View {
        Section {
            ForEach(tasks) { task in
                TaskRow(task: task) { openTask = task }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(RememberDesign.card)
                    .listRowSeparatorTint(RememberDesign.line)
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 56 }
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button {
                            timer.start(task.id)
                            Task { await store.startTask(task) }
                        } label: {
                            Label("Start", systemImage: "play.fill")
                        }
                        .tint(RememberDesign.accent)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task { await store.deleteTask(task) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        } header: {
            SectionHeading(title: title, trailing: trailing)
                .textCase(nil)
                .padding(.horizontal, -RememberDesign.spacingXXSmall)
        }
    }

    private var doneSection: some View {
        Section {
            if doneIsExpanded {
                ForEach(doneToday) { task in
                    HStack(spacing: RememberDesign.spacingCompact) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(RememberDesign.accent)
                        Text(task.title)
                            .foregroundStyle(RememberDesign.text3)
                            .strikethrough(color: RememberDesign.text3)
                    }
                    .listRowBackground(RememberDesign.card)
                    .listRowSeparatorTint(RememberDesign.line)
                }
            }
        } header: {
            Button {
                withAnimation(.snappy) { doneIsExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    SectionHeading(title: "Done today · \(doneToday.count)")
                    Image(systemName: doneIsExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(RememberDesign.text3)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .textCase(nil)
            .padding(.horizontal, -RememberDesign.spacingXXSmall)
            .accessibilityValue(doneIsExpanded ? "Shown" : "Hidden")
        }
    }

    private func totalTime(_ tasks: [LifeTask]) -> String {
        tasks.reduce(0) { $0 + $1.durationMinutes }.durationLabel
    }
}
