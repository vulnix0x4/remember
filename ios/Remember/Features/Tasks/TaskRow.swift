import SwiftUI

/// One task: tap the circle to finish it, tap the row to change it.
struct TaskRow: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    let task: LifeTask
    var onOpen: () -> Void

    @State private var isChecked = false

    var body: some View {
        // Rows are drawn flat; the group around them (TaskGroup or a grouped List) supplies the card and dividers.
        HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacingCompact) {
            Button(action: complete) {
                ZStack {
                    Circle()
                        .strokeBorder(isChecked ? RememberDesign.accent : RememberDesign.text3, lineWidth: 1.5)
                    if isChecked {
                        Circle().fill(RememberDesign.accent)
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(RememberDesign.accentInk)
                    }
                }
                .frame(width: 22, height: 22)
                .frame(width: 44, height: 44)
                .contentShape(.circle)
                // Line the circle up with the title's first line rather than the middle of the row.
                .alignmentGuide(.firstTextBaseline) { dimensions in dimensions[VerticalAlignment.center] + 6 }
            }
            .buttonStyle(.plain)
            .padding(.leading, -RememberDesign.spacingCompact)
            .accessibilityLabel("Mark \(task.title) done")
            .sensoryFeedback(.success, trigger: isChecked)

            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.body)
                        .foregroundStyle(isChecked ? RememberDesign.text3 : RememberDesign.text)
                        .strikethrough(isChecked, color: RememberDesign.text3)
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                    Text(meta)
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.text3)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 13)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the task to change it")
            .accessibilityIdentifier("remember.life-task.\(task.id.uuidString.lowercased())")
        }
        .padding(.trailing, RememberDesign.spacing)
        .padding(.leading, RememberDesign.spacingCompact)
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

/// A section of tasks drawn as one card with hairline dividers, like Reminders.
struct TaskGroup: View {
    let tasks: [LifeTask]
    let onOpen: (LifeTask) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(tasks) { task in
                TaskRow(task: task) { onOpen(task) }
                if task.id != tasks.last?.id {
                    Rectangle()
                        .fill(RememberDesign.line)
                        .frame(height: 0.5)
                        .padding(.leading, 56)
                }
            }
        }
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
    }
}
