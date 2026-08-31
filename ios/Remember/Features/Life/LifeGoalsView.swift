import SwiftUI

struct LifeGoalsView: View {
    @Environment(AppStore.self) private var store
    @State private var addIsPresented = false

    private var goals: [LifeGoal] { store.lifeSnapshot.goals.filter { $0.status != "archived" } }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("DIRECTION").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                                Text("Goals with a job to do.").font(.largeTitle.bold())
                                Text("Goals create a path. Tasks create evidence.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                            }
                            Spacer()
                            Button("Add", systemImage: "plus") { addIsPresented = true }
                                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                                .tint(RememberDesign.accent).foregroundStyle(RememberDesign.accentInk)
                        }
                        if goals.isEmpty {
                            ContentUnavailableView("Choose one direction", systemImage: "scope", description: Text("A useful goal describes an observable result."))
                                .frame(maxWidth: .infinity, minHeight: 320)
                                .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                        } else {
                            ForEach(goals) { goal in
                                VStack(alignment: .leading, spacing: 18) {
                                    Label(goal.area.label.uppercased(), systemImage: goal.area.symbol)
                                        .font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                                    Text(goal.title).font(.title.bold())
                                    if !goal.why.isEmpty { Text(goal.why).font(.subheadline).foregroundStyle(RememberDesign.secondaryText) }
                                    ProgressView(value: Double(goal.progress), total: 100).tint(RememberDesign.accent)
                                    HStack {
                                        Text("\(goal.progress)% complete").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                        Spacer()
                                        Button("Create next move", systemImage: "plus") {
                                            Task {
                                                await store.createLifeTask(title: "Move \(goal.title) forward", firstStep: "Choose the smallest visible action that produces evidence today.", area: goal.area, duration: 15, goalId: goal.id, source: "goal")
                                                store.selectedTab = .tasks
                                            }
                                        }
                                        .font(.caption.bold())
                                    }
                                }
                                .padding(22)
                                .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                            }
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .refreshable { await store.loadLife() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $addIsPresented) { GoalComposerView() }
        }
    }
}

private struct GoalComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var title = ""
    @State private var why = ""
    @State private var area = LifeArea.direction

    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section("Result") { TextField("What will be observably different?", text: $title, axis: .vertical) }
                SwiftUI.Section("Why now") { TextField("This matters because…", text: $why, axis: .vertical) }
                SwiftUI.Section("Life area") { Picker("Area", selection: $area) { ForEach(LifeArea.allCases, id: \.self) { Text($0.label).tag($0) } } }
            }
            .navigationTitle("New goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: dismiss.callAsFunction) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await store.createLifeGoal(title: title, area: area, why: why); dismiss() } }
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
