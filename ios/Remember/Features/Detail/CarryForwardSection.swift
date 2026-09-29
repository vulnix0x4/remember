import SwiftUI

struct CarryForwardSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var addingExperiment: String?
    @State private var addedExperiments: Set<String> = []
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            Text("Try it for real")
                .font(.rememberSectionTitle)
                .accessibilityAddTraits(.isHeader)

            ForEach(Array(imprint.experiments.enumerated()), id: \.element) { index, experiment in
                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    if index > 0 {
                        Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                    }
                    Text(experiment)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)

                    if addedExperiments.contains(experiment) {
                        Button("Added to Plan", systemImage: "checkmark", action: openPlan)
                            .buttonStyle(.rememberQuiet)
                    } else if index == 0 {
                        Button("Try this", systemImage: "plus") { add(experiment) }
                            .buttonStyle(.rememberPrimary)
                            .disabled(addingExperiment != nil)
                    } else {
                        Button("Try this", systemImage: "plus") { add(experiment) }
                            .buttonStyle(.rememberSecondary)
                            .disabled(addingExperiment != nil)
                    }
                }
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
        .sensoryFeedback(.success, trigger: addedExperiments.count)
    }

    private func add(_ experiment: String) {
        guard addingExperiment == nil else { return }
        addingExperiment = experiment
        errorMessage = nil
        Task {
            let succeeded = await store.createLifeTask(
                title: CarryForwardPlan.taskTitle(for: experiment),
                firstStep: experiment,
                notes: CarryForwardPlan.notes(for: imprint),
                area: CarryForwardPlan.area(for: imprint),
                duration: 15,
                source: "practice",
                sourceItemId: imprint.id
            )
            if succeeded {
                addedExperiments.insert(experiment)
            } else {
                errorMessage = "Couldn’t add that. Try again."
            }
            addingExperiment = nil
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
