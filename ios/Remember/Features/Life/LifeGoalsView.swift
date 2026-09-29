import SwiftUI

/// Plan → Goals: a few outcomes, each one tap away from its next step.
struct LifeGoalsView: View {
    @Environment(AppStore.self) private var store
    @Binding private var planSection: PlanSection
    @State private var stepGoal: LifeGoal?
    @State private var stepText = ""
    @State private var openGoal: LifeGoal?

    init(planSection: Binding<PlanSection> = .constant(.goals)) {
        _planSection = planSection
    }

    private var goals: [LifeGoal] {
        store.lifeSnapshot.goals
            .filter { $0.status != "archived" && $0.status != "completed" }
            .sorted { ($0.status == "active" ? 0 : 1) < ($1.status == "active" ? 0 : 1) }
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
                        if goals.isEmpty {
                            RememberEmptyState(
                                systemImage: "scope",
                                title: "What are you working toward?",
                                message: "Type one goal below, like “Run a 5K” or “Save $1,000”."
                            )
                        }
                        ForEach(goals) { goal in
                            goalCard(goal)
                        }
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacingSmall)
                    .padding(.bottom, RememberDesign.spacingLarge)
                }
                .refreshable { await store.loadLife() }
            }
            .rememberBottomDock {
                AddBar(placeholder: "Add a goal…", allowsDictation: true, accessibilityIdentifier: "remember.goal.quickAdd") { text in
                    let saved = await store.createLifeGoal(title: text, area: .direction, why: "")
                    if saved { store.showToast("Goal added") }
                    return saved
                }
            }
            .alert("Next step for “\(stepGoal?.title ?? "")”", isPresented: Binding(
                get: { stepGoal != nil },
                set: { if !$0 { stepGoal = nil } }
            )) {
                TextField("e.g. Buy running shoes", text: $stepText)
                Button("Add") {
                    let goal = stepGoal
                    let text = stepText
                    stepText = ""
                    Task { await store.quickAddTask(text, goalId: goal?.id) }
                }
                Button("Cancel", role: .cancel) { stepText = "" }
            }
            .sheet(item: $openGoal) { GoalProgressSheet(goal: $0) }
            .rememberPrimaryActions()
        }
    }

    private func goalCard(_ goal: LifeGoal) -> some View {
        let openSteps = store.lifeSnapshot.tasks.filter { $0.goalId == goal.id && ($0.status == .queued || $0.status == .inbox || $0.status == .active) }.count
        return VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Button {
                openGoal = goal
            } label: {
                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(goal.title)
                            .font(.rememberSectionTitle)
                            .foregroundStyle(goal.status == "paused" ? RememberDesign.text2 : .white)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Text(goal.status == "paused" ? "Paused" : "\(goal.progress)%")
                            .font(.subheadline.monospacedDigit().weight(.bold))
                            .foregroundStyle(goal.status == "paused" ? RememberDesign.text3 : RememberDesign.accent)
                    }
                    ProgressView(value: Double(goal.progress), total: 100)
                        .tint(RememberDesign.accent)
                        .scaleEffect(y: 1.6)
                    if openSteps > 0 {
                        Text(openSteps == 1 ? "1 step planned" : "\(openSteps) steps planned")
                            .font(.rememberMeta)
                            .foregroundStyle(RememberDesign.text2)
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Update progress")

            Button {
                stepGoal = goal
            } label: {
                Label("Add a step", systemImage: "plus")
            }
            .buttonStyle(.rememberSecondary)
        }
        .rememberCard(padding: RememberDesign.spacing + 4)
    }
}

private struct GoalProgressSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let goal: LifeGoal
    @State private var progress: Double

    init(goal: LifeGoal) {
        self.goal = goal
        _progress = State(initialValue: Double(goal.progress))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            Text(goal.title)
                .font(.rememberHero)
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "How far along?", trailing: "\(Int(progress))%")
                Slider(value: $progress, in: 0...100, step: 5)
                    .tint(RememberDesign.accent)
            }
            Button {
                dismiss()
                Task { await store.updateGoal(goal, progress: 100, status: "completed") }
                store.showToast("Goal complete. Well done.")
            } label: {
                Label("Mark complete", systemImage: "checkmark")
            }
            .buttonStyle(.rememberPrimary)
            Button(goal.status == "paused" ? "Resume goal" : "Pause goal") {
                dismiss()
                Task { await store.updateGoal(goal, status: goal.status == "paused" ? "active" : "paused") }
            }
            .buttonStyle(.rememberQuiet)
            .frame(maxWidth: .infinity)
        }
        .padding(RememberDesign.spacing)
        .padding(.top, RememberDesign.spacing)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
        .onDisappear {
            let value = Int(progress)
            if value != goal.progress, value < 100 {
                Task { await store.updateGoal(goal, progress: value) }
            }
        }
    }
}
