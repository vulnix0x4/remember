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
            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Put this to work")
                        .font(.rememberSectionTitle)
                    Text("From \(outcome.imprint.title)")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text2)
                        .lineLimit(1)
                }

                if let experiment = outcome.experiment {
                    Text(experiment)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                    if experimentWasAdded {
                        Button("Added to Plan", systemImage: "checkmark", action: openPlan)
                            .buttonStyle(.rememberQuiet)
                    } else {
                        Button("Try this experiment", systemImage: "plus") {
                            add(experiment, from: outcome.imprint)
                        }
                        .buttonStyle(.rememberSecondary)
                        .disabled(isAdding)
                    }
                }

                if let principle = outcome.principle {
                    if outcome.experiment != nil {
                        Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                    }
                    Text(principle)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                    let isKept = principleWasKept || outcome.imprint.principleStatus == "active"
                    Button(isKept ? "Kept" : "Keep this principle", systemImage: isKept ? "checkmark" : "bookmark") {
                        keepPrinciple(from: outcome.imprint)
                    }
                    .buttonStyle(.rememberQuiet)
                    .disabled(isKeeping || isKept)
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.danger)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing)
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
            if !succeeded { errorMessage = "Couldn’t add that. Try again." }
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
                errorMessage = "Not ready yet. Open the save and try again."
                isKeeping = false
                return
            }
            do {
                try await store.setPrincipleStatus(for: current, status: "active")
                principleWasKept = true
            } catch {
                errorMessage = "Couldn’t keep that. Try again."
            }
            isKeeping = false
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
