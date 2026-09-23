import SwiftUI

struct LifeGoalsView: View {
    @Environment(AppStore.self) private var store
    @Binding private var planSection: PlanSection
    @State private var addIsPresented = false
    @State private var taskGoal: LifeGoal?

    init(planSection: Binding<PlanSection> = .constant(.goals)) {
        _planSection = planSection
    }

    private var goals: [LifeGoal] {
        store.lifeSnapshot.goals.filter { $0.status != "archived" }
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
                Group {
                    if goals.isEmpty {
                        ContentUnavailableView {
                            Label("No goals yet", systemImage: "scope")
                        } description: {
                            Text("Choose one result you want to move toward.")
                        }
                    } else {
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: RememberDesign.spacing) {
                                ForEach(goals) { goal in
                                    goalCard(goal)
                                }
                            }
                            .padding(RememberDesign.spacing)
                            .padding(.bottom, RememberDesign.spacingXLarge)
                        }
                        .refreshable { await store.loadLife() }
                    }
                }
            }
            .navigationTitle("Goals")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                QuickAddBar(title: "Add a goal", systemImage: "plus") {
                    addIsPresented = true
                }
            }
            .sheet(isPresented: $addIsPresented) { GoalComposerView() }
            .sheet(item: $taskGoal) { goal in
                LifeTaskComposerView(goal: goal)
            }
            .rememberPrimaryActions()
        }
    }

    private func goalCard(_ goal: LifeGoal) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            HStack {
                Label(goal.area.label, systemImage: goal.area.symbol)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
                Spacer()
                Text("\(goal.progress)%")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            Text(goal.title)
                .font(.title3.bold())

            if !goal.why.isEmpty {
                Text(goal.why)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            ProgressView(value: Double(goal.progress), total: 100)
                .tint(RememberDesign.accent)

            Button("Add task for this goal", systemImage: "plus") {
                taskGoal = goal
            }
            .font(.subheadline.weight(.semibold))
            .frame(minHeight: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberSurface()
    }
}
