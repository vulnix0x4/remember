import SwiftUI

/// Routines waiting on a machine (the washer, the dryer), shown under the Today header so they're
/// never forgotten while Jev offers something else to do meanwhile.
struct BackgroundRoutinesStrip: View {
    @Environment(AppStore.self) private var store

    private struct Running: Identifiable {
        let task: LifeTask
        let step: RoutineStep
        let next: RoutineStep?
        let endsAt: Date
        var id: UUID { task.id }
    }

    private var running: [Running] {
        store.lifeSnapshot.tasks.compactMap { task in
            guard task.status != .done, task.status != .removed,
                  let steps = store.lifeSnapshot.commitment(for: task)?.steps, !steps.isEmpty else { return nil }
            let progress = RoutineProgress.load(task.id)
            guard let endsAt = progress.waitEndsAt, steps.indices.contains(progress.stepIndex) else { return nil }
            let next = steps.indices.contains(progress.stepIndex + 1) ? steps[progress.stepIndex + 1] : nil
            return Running(task: task, step: steps[progress.stepIndex], next: next, endsAt: endsAt)
        }
        .sorted { $0.endsAt < $1.endsAt }
    }

    var body: some View {
        let items = running
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "In the background")
                SwiftUI.TimelineView(.periodic(from: .now, by: 30)) { context in
                    VStack(spacing: 0) {
                        ForEach(items) { item in
                            row(item, now: context.date)
                            if item.id != items.last?.id {
                                Rectangle().fill(RememberDesign.line).frame(height: 0.5).padding(.leading, 56)
                            }
                        }
                    }
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                }
            }
        }
    }

    private func row(_ item: Running, now: Date) -> some View {
        let isDone = item.endsAt <= now
        let minutesLeft = max(1, Int(ceil(item.endsAt.timeIntervalSince(now) / 60)))
        let machine = item.step.title.replacingOccurrences(of: " running", with: "")
        return Button {
            store.lockInTask = item.task
        } label: {
            HStack(spacing: RememberDesign.spacingCompact) {
                Image(systemName: isDone ? "bell.fill" : "hourglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 3) {
                    Text(isDone ? "\(machine)'s done" : "\(item.task.title) · \(item.step.title)")
                        .font(.body)
                        .foregroundStyle(RememberDesign.text)
                    Text(isDone ? (item.next.map { "Next: \($0.title)" } ?? "Tap to finish up") : "\(minutesLeft) min left")
                        .font(.footnote)
                        .foregroundStyle(isDone ? RememberDesign.accent : RememberDesign.text3)
                }
                Spacer()
                if isDone {
                    Text("Continue")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(RememberDesign.primaryInk)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 36)
                        .background(RememberDesign.primaryFill, in: .capsule)
                }
            }
            .padding(.horizontal, RememberDesign.spacingCompact)
            .padding(.vertical, 12)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("remember.background.\(item.task.id.uuidString.lowercased())")
        .accessibilityHint(isDone ? "Continues the routine" : "Opens the routine")
    }
}
