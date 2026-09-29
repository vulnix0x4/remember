import SwiftUI

struct WeeklySynthesisCard: View {
    let synthesis: WeeklySynthesis
    @Environment(AppStore.self) private var store
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var experimentToRetry: CompassExperiment?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("This week")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text2)
                    .accessibilityIdentifier("remember.today.weekly-synthesis")
                Text(synthesis.headline)
                    .font(.rememberSectionTitle)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !synthesis.story.isEmpty {
                Text(synthesis.story)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let reflection = synthesis.reflection {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("What you noticed")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text3)
                    Text(reflection)
                        .font(.body.italic())
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.leading, RememberDesign.spacingCompact)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(RememberDesign.line)
                        .frame(width: 2)
                }
            }

            outcomeAction

            if let source = synthesis.experiment?.imprint {
                NavigationLink(value: source) {
                    Label("See what shaped this", systemImage: "books.vertical")
                }
                .buttonStyle(.rememberQuiet)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
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
                }
                .buttonStyle(.rememberSecondary)
                .disabled(isSaving)
            } else {
                Label("Already carried into Plan", systemImage: "checkmark")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
            }
        case .some(.mixed):
            if synthesis.canCarryForward, let experiment = synthesis.experiment {
                Button(action: { experimentToRetry = experiment }) {
                    Label("Try a smaller version", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.rememberSecondary)
            } else {
                Label("Already carried into Plan", systemImage: "checkmark")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
            }
        case .some(.notForMe):
            Text("Nothing to carry. That’s useful too.")
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
                errorMessage = "Couldn’t add that. Try again."
                isSaving = false
            }
        }
    }
}
