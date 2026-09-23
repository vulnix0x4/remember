import SwiftUI

/// "I'm stuck": four plain choices, one tap each. Replaces the blocker dialog and task switcher.
struct StuckSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Environment(\.dismiss) private var dismiss
    let task: LifeTask

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text("What’s getting in the way?")
                .font(.rememberSectionTitle)
                .padding(.bottom, RememberDesign.spacingXXSmall)
                .accessibilityAddTraits(.isHeader)

            option("It’s too big", detail: "Shrink it to a two-minute start", systemImage: "scissors") {
                await store.adaptTask(task, reason: .big)
            }
            option("Not sure where to start", detail: "Get one clear first step", systemImage: "signpost.right") {
                await store.adaptTask(task, reason: .unclear)
            }
            option("Only have 5 minutes", detail: "Do the smallest useful piece", systemImage: "timer") {
                await store.adaptTask(task, reason: .time)
            }
            option("Do something else", detail: "Jev picks the next thing", systemImage: "arrow.triangle.swap") {
                timer.reset()
                await store.setTaskAside(task)
            }

            Button("Delete task", role: .destructive) {
                dismiss()
                timer.reset()
                Task { await store.deleteTask(task) }
            }
            .buttonStyle(.rememberDanger)
            .frame(maxWidth: .infinity)
            .padding(.top, RememberDesign.spacingXXSmall)
            .accessibilityIdentifier("remember.stuck.delete")
        }
        .padding(RememberDesign.spacing)
        .padding(.top, RememberDesign.spacingSmall)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private func option(_ title: String, detail: String, systemImage: String, action: @escaping () async -> Void) -> some View {
        Button {
            dismiss()
            Task { await action() }
        } label: {
            HStack(spacing: RememberDesign.spacingCompact) {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                    .frame(width: 40, height: 40)
                    .background(RememberDesign.accent.opacity(0.14), in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.rememberRowTitle).foregroundStyle(RememberDesign.text)
                    Text(detail).font(.subheadline).foregroundStyle(RememberDesign.text2)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, RememberDesign.spacing)
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
            .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
        }
        .buttonStyle(.plain)
    }
}
