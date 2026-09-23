import SwiftUI

struct CarryForwardSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var addingExperiment: String?
    @State private var addedExperiments: Set<String> = []
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            Label("Carry it forward", systemImage: "flask")
                .font(.subheadline)
                .bold()
                .foregroundStyle(RememberDesign.accent)

            Text("Don’t just save the idea. Try it.")
                .font(.title2)
                .bold()

            Text("Remember found a small way to test this in your own life. Add it to Plan when you want the idea to become more than something you agreed with.")
                .font(.body)
                .foregroundStyle(RememberDesign.secondaryText)

            ForEach(imprint.experiments, id: \.self) { experiment in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text(experiment)
                        .font(.headline)
                        .fixedSize(horizontal: false, vertical: true)

                    if addedExperiments.contains(experiment) {
                        Button("Added to Plan", systemImage: "checkmark", action: openPlan)
                            .buttonStyle(.bordered)
                            .tint(RememberDesign.accent)
                    } else {
                        Button("Try this", systemImage: "plus") {
                            add(experiment)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .disabled(addingExperiment != nil)
                    }
                }
                .padding(RememberDesign.spacing)
                .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .padding(RememberDesign.spacing)
        .background(RememberDesign.accent.opacity(0.08), in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: RememberDesign.cornerRadius)
                .stroke(RememberDesign.accent.opacity(0.28))
        }
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
                errorMessage = "This experiment could not be added to Plan. Try again."
            }
            addingExperiment = nil
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
