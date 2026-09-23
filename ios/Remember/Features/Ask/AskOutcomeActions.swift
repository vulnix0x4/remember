import SwiftUI

struct AskOutcomeActions: View {
    let message: AskMessage
    let imprints: [Imprint]
    @Environment(AppStore.self) private var store
    @State private var isAdding = false
    @State private var experimentWasAdded = false
    @State private var isKeeping = false
    @State private var principleWasKept = false
    @State private var errorMessage: String?

    var body: some View {
        if let outcome = AskOutcomeBuilder.build(for: message, imprints: imprints) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Divider()
                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                    Text("Put this to work")
                        .font(.headline)
                    Text("From \(outcome.imprint.title)")
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.secondaryText)
                }

                if let experiment = outcome.experiment {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Label("A small experiment", systemImage: "flask")
                            .font(.footnote.bold())
                            .foregroundStyle(RememberDesign.accent)
                        Text(experiment)
                            .font(.subheadline)
                        if experimentWasAdded {
                            Button("Added to Plan", systemImage: "checkmark", action: openPlan)
                                .buttonStyle(.bordered)
                        } else {
                            Button("Try this experiment", systemImage: "plus") {
                                add(experiment, from: outcome.imprint)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(RememberDesign.accent)
                            .foregroundStyle(RememberDesign.accentInk)
                            .disabled(isAdding)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(RememberDesign.spacingCompact)
                    .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                }

                if let principle = outcome.principle {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Label("A principle to consider", systemImage: "compass.drawing")
                            .font(.footnote.bold())
                            .foregroundStyle(RememberDesign.accent)
                        Text(principle)
                            .font(.subheadline)
                        Button(principleWasKept || outcome.imprint.principleStatus == "active" ? "Kept" : "Keep this principle", systemImage: principleWasKept || outcome.imprint.principleStatus == "active" ? "checkmark" : "bookmark") {
                            keepPrinciple(from: outcome.imprint)
                        }
                        .buttonStyle(.bordered)
                        .disabled(isKeeping || principleWasKept || outcome.imprint.principleStatus == "active")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(RememberDesign.spacingCompact)
                    .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.danger)
                }
            }
            .sensoryFeedback(.success, trigger: experimentWasAdded)
            .sensoryFeedback(.success, trigger: principleWasKept)
        }
    }

    private func add(_ experiment: String, from imprint: Imprint) {
        guard !isAdding else { return }
        isAdding = true
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
            experimentWasAdded = succeeded
            if !succeeded { errorMessage = "This experiment could not be added to Plan. Try again." }
            isAdding = false
        }
    }

    private func keepPrinciple(from imprint: Imprint) {
        guard !isKeeping else { return }
        isKeeping = true
        errorMessage = nil
        Task {
            await store.loadDetail(imprint)
            guard let current = store.imprint(withID: imprint.id), current.principleID != nil else {
                errorMessage = "This principle is not ready to keep yet. Open the saved item and try again."
                isKeeping = false
                return
            }
            do {
                try await store.setPrincipleStatus(for: current, status: "active")
                principleWasKept = true
            } catch {
                errorMessage = "This principle could not be kept. Try again."
            }
            isKeeping = false
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
