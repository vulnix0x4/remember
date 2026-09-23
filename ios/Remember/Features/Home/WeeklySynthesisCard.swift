import SwiftUI

struct WeeklySynthesisCard: View {
    let synthesis: WeeklySynthesis
    @Environment(AppStore.self) private var store
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var experimentToRetry: CompassExperiment?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("This week, remembered")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.accent)
                    .accessibilityIdentifier("remember.today.weekly-synthesis")
                Text(synthesis.headline)
                    .font(.title2.bold())
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !synthesis.story.isEmpty {
                Text(synthesis.story)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let reflection = synthesis.reflection {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("What you noticed")
                        .font(.caption.bold())
                        .foregroundStyle(RememberDesign.secondaryText)
                    Text(reflection)
                        .font(.body.italic())
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.leading, RememberDesign.spacingCompact)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(RememberDesign.accent)
                        .frame(width: 2)
                }
            }

            outcomeAction

            if let source = synthesis.experiment?.imprint {
                NavigationLink(value: source) {
                    Label("See what shaped this", systemImage: "books.vertical")
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(RememberDesign.accent)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberSurface()
        .sheet(item: $experimentToRetry) { experiment in
            RetryPracticeView(experiment: experiment) {
                store.selectedTab = .tasks
            }
        }
    }

    @ViewBuilder
    private var outcomeAction: some View {
        switch synthesis.outcome {
        case .some(.helped):
            if synthesis.canCarryForward, let experiment = synthesis.experiment {
                Button(action: { carryForward(experiment) }) {
                    Label(isSaving ? "Adding…" : "Repeat what worked", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .buttonBorderShape(.roundedRectangle(radius: RememberDesign.controlRadius))
                .disabled(isSaving)
            } else {
                Label("Already carried into Plan", systemImage: "checkmark")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        case .some(.mixed):
            if synthesis.canCarryForward, let experiment = synthesis.experiment {
                Button(action: { experimentToRetry = experiment }) {
                    Label("Try a smaller version", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .buttonBorderShape(.roundedRectangle(radius: RememberDesign.controlRadius))
            } else {
                Label("Already carried into Plan", systemImage: "checkmark")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        case .some(.notForMe):
            Text("Nothing to do. Knowing what not to carry is useful too.")
                .font(.subheadline)
                .foregroundStyle(RememberDesign.secondaryText)
        case nil:
            EmptyView()
        }
    }

    private func carryForward(_ experiment: CompassExperiment) {
        guard !isSaving else { return }
        isSaving = true
        errorMessage = nil
        let task = experiment.task
        Task {
            let succeeded = await store.createLifeTask(
                title: task.title,
                firstStep: task.firstStep,
                notes: task.notes,
                area: task.area,
                duration: task.durationMinutes,
                priority: task.priority,
                source: "practice",
                sourceItemId: task.sourceItemId
            )
            if succeeded {
                store.selectedTab = .tasks
            } else {
                errorMessage = "That could not be added to Plan. Try again."
                isSaving = false
            }
        }
    }
}
