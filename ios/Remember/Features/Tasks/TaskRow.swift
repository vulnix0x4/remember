import SwiftUI

/// One task: tap the circle to finish it, tap the row to change it.
struct TaskRow: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    let task: LifeTask
    var onOpen: () -> Void

    @State private var isChecked = false

    var body: some View {
        HStack(spacing: RememberDesign.spacingCompact) {
            Button(action: complete) {
                ZStack {
                    Circle()
                        .strokeBorder(isChecked ? RememberDesign.accent : RememberDesign.text3, lineWidth: 2)
                    if isChecked {
                        Circle().fill(RememberDesign.accent)
                        Image(systemName: "checkmark")
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(RememberDesign.accentInk)
                    }
                }
                .frame(width: 28, height: 28)
                .frame(width: 44, height: 44)
                .contentShape(.circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mark \(task.title) done")
            .sensoryFeedback(.success, trigger: isChecked)

            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(task.title)
                        .font(.rememberRowTitle)
                        .foregroundStyle(isChecked ? RememberDesign.text3 : .white)
                        .strikethrough(isChecked, color: RememberDesign.text3)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(meta)
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text2)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the task to change it")
            .accessibilityIdentifier("remember.life-task.\(task.id.uuidString.lowercased())")
        }
        .padding(.leading, 6)
        .padding(.trailing, RememberDesign.spacing)
        .frame(minHeight: RememberDesign.rowHeight + 8)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: "Start now") { Task { timer.start(task.id); await store.startTask(task) } }
        .accessibilityAction(named: "Delete") { Task { await store.deleteTask(task) } }
    }

    private var meta: String {
        var parts = [task.durationMinutes.durationLabel]
        if let start = [task.notBefore, task.scheduledStart].compactMap({ $0 }).max(), start > .now {
            parts.append(start.relativeDayLabel)
        } else if let planned = store.brain?.plan.first(where: { $0.taskId == task.id })?.startAt, planned > .now {
            parts.append(planned.relativeDayLabel)
        }
        if let due = task.dueAt { parts.append("Due \(due.relativeDayLabel)") }
        if let days = task.repeatEveryDays { parts.append("↻ \(days.repeatLabel)") }
        if task.priority == .high || task.priority == .must { parts.append(task.priority == .must ? "Urgent" : "Important") }
        return parts.joined(separator: " · ")
    }

    private func complete() {
        guard !isChecked else { return }
        withAnimation(.snappy(duration: 0.2)) { isChecked = true }
        Task {
            try? await Task.sleep(for: .milliseconds(350))
            if timer.isTracking(task.id) { timer.reset() }
            let succeeded = await store.completeTask(task, minutesSpent: 0)
            if !succeeded { withAnimation { isChecked = false } }
        }
    }
}
