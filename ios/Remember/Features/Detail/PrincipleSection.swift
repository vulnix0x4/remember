import SwiftUI

struct PrincipleSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var isUpdating = false
    @State private var updateError: String?

    private var isKept: Bool { imprint.principleStatus == "active" }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Optional", title: "Carry something forward")
            if let principle = imprint.candidatePrinciples.first {
                Label(principle, systemImage: "compass.drawing")
                    .font(.headline)
            }
            if let experiment = imprint.experiments.first {
                Text(experiment)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            if imprint.principleID != nil {
                Button(isKept ? "Kept in your active principles" : "Keep this principle", systemImage: isKept ? "checkmark" : "arrow.forward") {
                    update()
                }
                .buttonStyle(.bordered)
                .disabled(isUpdating)
                .sensoryFeedback(.success, trigger: isKept)
            }
            if let updateError {
                Label(updateError, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .padding(RememberDesign.spacing)
        .background(RememberDesign.accent.opacity(0.1), in: .rect(cornerRadius: RememberDesign.cornerRadius))
    }

    private func update() {
        guard !isUpdating else { return }
        isUpdating = true
        updateError = nil
        Task {
            do {
                try await store.setPrincipleStatus(for: imprint, status: isKept ? "candidate" : "active")
            } catch {
                updateError = "This principle could not be updated."
            }
            isUpdating = false
        }
    }
}
