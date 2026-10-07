import SwiftUI

/// Plan → Projects: the big areas of life, each with its own pile of tasks and one button for deep work on it.
struct LifeProjectsView: View {
    @Environment(AppStore.self) private var store
    @Binding private var planSection: PlanSection
    @State private var openProject: LifeGoal?

    init(planSection: Binding<PlanSection> = .constant(.goals)) {
        _planSection = planSection
    }

    private var projects: [LifeGoal] {
        store.lifeSnapshot.goals
            .filter { $0.status == "active" || $0.status == "paused" }
            .sorted { left, right in
                let leftRank = left.status == "active" ? 0 : 1, rightRank = right.status == "active" ? 0 : 1
                return leftRank != rightRank ? leftRank < rightRank : left.createdAt < right.createdAt
            }
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
                    VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                        if projects.isEmpty {
                            RememberEmptyState(
                                systemImage: "folder",
                                title: "What are you working on?",
                                message: "Add one below, like College or My app."
                            )
                        }
                        ForEach(projects) { project in
                            projectCard(project)
                        }
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacingSmall)
                    .padding(.bottom, RememberDesign.spacingLarge)
                }
                .refreshable { await store.loadLife() }
            }
            .rememberBottomDock {
                AddBar(placeholder: "Add a project…", accessibilityIdentifier: "remember.project.quickAdd") { text in
                    let saved = await store.createLifeGoal(title: text, area: .direction, why: "")
                    if saved { store.showToast("\(text) added") }
                    return saved
                }
            }
            .sheet(item: $openProject) { ProjectSheet(projectID: $0.id) }
            .rememberPrimaryActions()
        }
    }

    private func projectCard(_ project: LifeGoal) -> some View {
        let summary = ProjectSummary(project: project, store: store)
        return VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Button {
                openProject = project
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(project.title)
                        .font(.rememberSectionTitle)
                        .foregroundStyle(project.status == "paused" ? RememberDesign.text2 : .white)
                        .multilineTextAlignment(.leading)
                    Text(project.status == "paused" ? "Paused · \(summary.meta)" : summary.meta)
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text2)
                    if let next = summary.next {
                        Text("Next: \(next.title)")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows its tasks")

            if project.status == "active" {
                Button {
                    store.startProjectBlock(project)
                } label: {
                    Label("Work on it", systemImage: "scope")
                }
                .buttonStyle(.rememberSecondary)
                .accessibilityIdentifier("remember.project.workOnIt")
            }
        }
        .rememberCard(padding: RememberDesign.spacing + 4)
        .opacity(project.status == "paused" ? 0.6 : 1)
    }
}

/// A project's open tasks, their total time, and the next one in Jev's order.
private struct ProjectSummary {
    let open: [LifeTask]
    let next: LifeTask?
    let meta: String

    @MainActor
    init(project: LifeGoal, store: AppStore) {
        open = store.lifeSnapshot.tasks.filter {
            $0.goalId == project.id && ($0.status == .queued || $0.status == .inbox || $0.status == .active)
        }
        next = store.blockTask(for: project.id)
        let minutes = open.reduce(0) { $0 + $1.durationMinutes }
        meta = open.isEmpty ? "No tasks yet" : "\(open.count == 1 ? "1 task" : "\(open.count) tasks") · \(minutes.durationLabel)"
    }
}

/// One project: rename it, see its tasks, and start deep work for as long as you choose.
private struct ProjectSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let projectID: UUID
    @State private var title = ""
    @State private var minutes = ProjectBlock.defaultMinutes
    @State private var openTask: LifeTask?

    private var project: LifeGoal? { store.lifeSnapshot.goals.first { $0.id == projectID } }

    var body: some View {
        NavigationStack {
            if let project {
                content(project)
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
        .onAppear { title = project?.title ?? "" }
        .onDisappear(perform: saveTitle)
        .sheet(item: $openTask) { TaskEditorSheet(task: $0) }
    }

    private func content(_ project: LifeGoal) -> some View {
        let tasks = ProjectSummary(project: project, store: store).open
            .sorted { ($0.status == .active ? 0 : 1, $0.createdAt) < ($1.status == .active ? 0 : 1, $1.createdAt) }
        return ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                TextField("Project", text: $title, axis: .vertical)
                    .font(.rememberHero)
                    .lineLimit(1...3)
                    .submitLabel(.done)
                    .accessibilityLabel("Project name")

                if tasks.isEmpty {
                    Text("No tasks yet. Anything you add about \(project.title) lands here.")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                } else {
                    TaskGroup(tasks: tasks) { openTask = $0 }
                }

                if project.status == "active" {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        SectionHeading(title: "How long")
                        HStack(spacing: RememberDesign.spacingSmall) {
                            ForEach(ProjectBlock.lengths, id: \.self) { length in
                                let isOn = minutes == length
                                Button {
                                    minutes = length
                                } label: {
                                    Text(length.durationLabel)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(isOn ? RememberDesign.canvas : .white)
                                        .padding(.horizontal, RememberDesign.spacing)
                                        .frame(minHeight: 44)
                                        .background(isOn ? RememberDesign.primaryFill : RememberDesign.cardRaised, in: .capsule)
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(isOn ? .isSelected : [])
                                .sensoryFeedback(.selection, trigger: isOn)
                            }
                        }
                    }
                }
            }
            .padding(RememberDesign.spacing)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: RememberDesign.spacingXXSmall) {
                if project.status == "active" {
                    Button {
                        saveTitle()
                        dismiss()
                        store.startProjectBlock(project, minutes: minutes)
                    } label: {
                        Label("Work on it", systemImage: "scope")
                    }
                    .buttonStyle(.rememberPrimary)
                }
                HStack {
                    Button(project.status == "paused" ? "Resume" : "Pause") {
                        setStatus(project, project.status == "paused" ? "active" : "paused")
                    }
                    .buttonStyle(.rememberQuiet)
                    Spacer()
                    Button("Finish project") { setStatus(project, "completed") }
                        .buttonStyle(.rememberQuiet)
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.vertical, RememberDesign.spacingSmall)
            .background(RememberDesign.canvas)
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
                    .fontWeight(.semibold)
            }
        }
        .background(RememberDesign.canvas)
    }

    private func saveTitle() {
        guard let project else { return }
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, clean != project.title else { return }
        Task { await store.updateGoal(project, title: clean) }
    }

    private func setStatus(_ project: LifeGoal, _ status: String) {
        saveTitle()
        dismiss()
        let previous = project.status
        Task { await store.updateGoal(project, status: status) }
        let message = switch status {
        case "completed": "\(project.title) finished"
        case "paused": "\(project.title) paused"
        default: "\(project.title) resumed"
        }
        store.showToast(message) { [store] in
            await store.updateGoal(project, status: previous)
        }
    }
}
