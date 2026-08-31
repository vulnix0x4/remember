import SwiftUI

struct LifeTasksView: View {
    @Environment(AppStore.self) private var store
    @State private var addIsPresented = false
    @State private var blockerIsPresented = false
    @State private var startedAt: Date?
    @State private var floorAddIsPresented = false

    private var queued: [LifeTask] {
        store.lifeSnapshot.tasks.filter { $0.status == .queued || $0.status == .inbox }
    }

    private var completed: [LifeTask] {
        store.lifeSnapshot.tasks.filter { $0.status == .done }.sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        header
                        if let active = store.lifeSnapshot.activeTask {
                            activeMove(active)
                        } else {
                            ContentUnavailableView {
                                Label("Choose the next move", systemImage: "bolt")
                            } description: {
                                Text("Add one physical action. Everything else can wait its turn.")
                            } actions: {
                                Button("Add a move", systemImage: "plus") { addIsPresented = true }
                            }
                            .frame(maxWidth: .infinity, minHeight: 320)
                            .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                        }
                        if !queued.isEmpty { taskPath }
                        lifeFloor
                        if !completed.isEmpty { completionHistory }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .refreshable { await store.loadLife() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $addIsPresented) { LifeTaskComposerView() }
            .sheet(isPresented: $floorAddIsPresented) { LifeFloorComposerView() }
            .confirmationDialog("What’s blocking this?", isPresented: $blockerIsPresented, titleVisibility: .visible) {
                if let active = store.lifeSnapshot.activeTask {
                    ForEach(LifeBlockerReason.allCases, id: \.self) { reason in
                        Button(reason.label, role: reason == .irrelevant ? .destructive : nil) {
                            Task { await store.blockLifeTask(active.id, reason: reason) }
                        }
                    }
                }
            } message: {
                Text("No guilt. Change the move until it fits reality.")
            }
        }
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text("RESET EXECUTION ENGINE")
                    .font(.caption2.bold())
                    .foregroundStyle(RememberDesign.accent)
                Text("Do the next right thing.")
                    .font(.largeTitle.bold())
                Text("One active move. Everything else waits its turn.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            Spacer()
            Button("Add", systemImage: "plus") { addIsPresented = true }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
        }
    }

    private func activeMove(_ task: LifeTask) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Label("YOUR ONE MOVE", systemImage: "location.fill")
                    .font(.caption2.bold())
                    .foregroundStyle(RememberDesign.accent)
                Spacer()
                Label("\(task.durationMinutes) min", systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            Text(task.title)
                .font(.system(size: 43, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.72)
            VStack(alignment: .leading, spacing: 7) {
                Text("FIRST PHYSICAL ACTION")
                    .font(.caption2.bold())
                    .foregroundStyle(RememberDesign.accent)
                Text(task.firstStep.isEmpty ? "Write the first visible action. Then do only that." : task.firstStep)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .padding(.leading, 15)
            .overlay(alignment: .leading) { Rectangle().fill(RememberDesign.accent).frame(width: 2) }
            if let startedAt {
                TimelineView(.periodic(from: startedAt, by: 1)) { context in
                    Label(context.date.timeIntervalSince(startedAt).formattedElapsed, systemImage: "timer")
                        .font(.title2.monospacedDigit().bold())
                        .foregroundStyle(RememberDesign.accent)
                        .accessibilityLabel("Focus timer \(context.date.timeIntervalSince(startedAt).formattedElapsed)")
                }
            }
            VStack(spacing: 10) {
                Button(startedAt == nil ? "Start now" : "Pause", systemImage: startedAt == nil ? "play.fill" : "pause.fill") {
                    startedAt = startedAt == nil ? .now : nil
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .frame(maxWidth: .infinity)
                Button("Complete move", systemImage: "checkmark") {
                    let minutes = max(1, Int(Date.now.timeIntervalSince(startedAt ?? .now) / 60))
                    startedAt = nil
                    Task { await store.completeLifeTask(task.id, minutesSpent: minutes) }
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                Button("I can’t do this") { blockerIsPresented = true }
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RadialGradient(colors: [RememberDesign.accent.opacity(0.12), RememberDesign.surface], center: .topTrailing, startRadius: 0, endRadius: 360),
            in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius)
        )
        .overlay { RoundedRectangle(cornerRadius: RememberDesign.cornerRadius).stroke(RememberDesign.accent.opacity(0.3)) }
    }

    private var taskPath: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("UP NEXT").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
            Text("The path").font(.title.bold()).padding(.bottom, 10)
            ForEach(Array(queued.enumerated()), id: \.element.id) { index, task in
                Button { Task { await store.activateLifeTask(task.id) } } label: {
                    HStack(spacing: 14) {
                        Text(String(format: "%02d", index + 1))
                            .font(.headline.monospacedDigit())
                            .foregroundStyle(RememberDesign.tertiaryText)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(task.title).font(.subheadline.bold()).foregroundStyle(.primary)
                            Text(task.firstStep.isEmpty ? "First step not defined" : task.firstStep)
                                .font(.caption).foregroundStyle(RememberDesign.secondaryText).lineLimit(2)
                        }
                        Spacer()
                        Text("\(task.durationMinutes)m").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                        Image(systemName: "arrow.right").foregroundStyle(RememberDesign.accent)
                    }
                    .padding(.vertical, 15)
                }
                .buttonStyle(.plain)
                Divider().overlay(RememberDesign.line)
            }
        }
    }

    private var completionHistory: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RECENTLY COMPLETED").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
            ForEach(completed.prefix(6)) { task in
                Label(task.title, systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }

    private var lifeFloor: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("LIFE FLOOR").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                    Text("Minimums that keep you okay.").font(.title2.bold())
                }
                Spacer()
                Button("Add", systemImage: "plus") { floorAddIsPresented = true }
                    .font(.caption.bold())
            }
            Text("Not streaks or stretch goals—just the smallest daily actions that stop a hard week becoming a lost month.")
                .font(.caption)
                .foregroundStyle(RememberDesign.secondaryText)
            if store.lifeSnapshot.floor.isEmpty {
                Button("Set a baseline", systemImage: "checkmark.circle") { floorAddIsPresented = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
            } else {
                ForEach(store.lifeSnapshot.floor) { item in
                    let isComplete = item.completionDates.contains { Calendar.current.isDateInToday($0) }
                    Button { Task { await store.toggleLifeFloorItem(item.id) } } label: {
                        HStack(spacing: 13) {
                            Image(systemName: isComplete ? "checkmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundStyle(isComplete ? RememberDesign.accent : RememberDesign.tertiaryText)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.subheadline.bold()).foregroundStyle(.primary)
                                Text("\(item.target) \(item.unit) · \(item.area.label)")
                                    .font(.caption2).foregroundStyle(RememberDesign.secondaryText)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(20)
        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
    }
}

private struct LifeTaskComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var title = ""
    @State private var firstStep = ""
    @State private var area = LifeArea.direction
    @State private var duration = 15
    @State private var priority = LifeTaskPriority.normal

    var body: some View {
        NavigationStack {
            Form {
                Section("Outcome") { TextField("What will be different?", text: $title, axis: .vertical) }
                Section("First physical action") {
                    TextField("Open…, write…, call…, put…", text: $firstStep, axis: .vertical)
                } footer: { Text("Small enough to begin without more planning.") }
                Section("Context") {
                    Picker("Area", selection: $area) { ForEach(LifeArea.allCases, id: \.self) { Text($0.label).tag($0) } }
                    Picker("Time box", selection: $duration) { ForEach([5, 10, 15, 25, 45, 60, 90], id: \.self) { Text("\($0) minutes").tag($0) } }
                    Picker("Priority", selection: $priority) { ForEach(LifeTaskPriority.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }
                }
            }
            .navigationTitle("New move")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: dismiss.callAsFunction) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await store.createLifeTask(title: title, firstStep: firstStep, area: area, duration: duration, priority: priority)
                            dismiss()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || firstStep.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private struct LifeFloorComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var title = ""
    @State private var area = LifeArea.health
    @State private var target = 1
    @State private var unit = "time"

    var body: some View {
        NavigationStack {
            Form {
                Section("Daily baseline") { TextField("Take medication", text: $title) }
                Section("Measure") {
                    Picker("Area", selection: $area) { ForEach(LifeArea.allCases, id: \.self) { Text($0.label).tag($0) } }
                    Stepper("Target: \(target)", value: $target, in: 1...100)
                    TextField("Unit (time, minutes, glasses…)", text: $unit)
                }
            }
            .navigationTitle("Life Floor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: dismiss.callAsFunction) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await store.createLifeFloorItem(title: title, area: area, target: target, unit: unit)
                            dismiss()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private extension TimeInterval {
    var formattedElapsed: String {
        let seconds = max(0, Int(self))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}
