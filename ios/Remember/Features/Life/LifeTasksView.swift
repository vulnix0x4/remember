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
                    Group {

                        if !todayTasks.isEmpty {
                            section("Today", tasks: todayTasks, trailing: totalTime(todayTasks))
                        }
                        if !laterTasks.isEmpty {
                            section("Later", tasks: laterTasks)
                        }
                        if currentID == nil && todayTasks.isEmpty && laterTasks.isEmpty {
                            RememberEmptyState(
                                systemImage: "checklist",
                                title: "Nothing planned",
                                message: "Type anything in the bar below. “Call mom tomorrow 15m” works."
                            )
                        }

                        DailyBasicsStrip { isAddingBasic = true }
                            .padding(.top, RememberDesign.spacingSmall)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

                        if !doneToday.isEmpty { doneSection }
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                .listStyle(.plain)
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

    @ViewBuilder
    private func section(_ title: String, tasks: [LifeTask], trailing: String? = nil) -> some View {
        SectionHeading(title: title, trailing: trailing)
            .padding(.top, RememberDesign.spacing)
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 0, trailing: 16))
        ForEach(tasks) { task in
            TaskRow(task: task) { openTask = task }
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
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
    }

    @ViewBuilder
    private var doneSection: some View {
        Button {
            withAnimation(.snappy) { doneIsExpanded.toggle() }
        } label: {
            HStack {
                SectionHeading(title: "Done today · \(doneToday.count)")
                Image(systemName: doneIsExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RememberDesign.text3)
            }
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .padding(.top, RememberDesign.spacing)
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 0, trailing: 16))
        .accessibilityValue(doneIsExpanded ? "Shown" : "Hidden")
        if doneIsExpanded {
            ForEach(doneToday) { task in
                HStack(spacing: RememberDesign.spacingCompact) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(RememberDesign.accent)
                    Text(task.title)
                        .font(.body)
                        .foregroundStyle(RememberDesign.text2)
                        .strikethrough(color: RememberDesign.text3)
                    Spacer()
                }
                .frame(minHeight: 44)
                .listRowInsets(EdgeInsets(top: 0, leading: 24, bottom: 0, trailing: 16))
            }
        }
    }

    private func totalTime(_ tasks: [LifeTask]) -> String {
        tasks.reduce(0) { $0 + $1.durationMinutes }.durationLabel
    }
}
