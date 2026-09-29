import SwiftUI

struct PrincipleSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var isUpdating = false
    @State private var updateError: String?

    private var isKept: Bool { imprint.principleStatus == "active" }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            SectionHeading(title: "Takeaway")
            if let principle = imprint.candidatePrinciples.first {
                Text(principle)
                    .font(.rememberSectionTitle)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if imprint.principleID != nil {
                Button(isKept ? "Remove takeaway" : "Keep takeaway", systemImage: isKept ? "minus" : "plus") {
                    update()
                }
                .buttonStyle(.rememberSecondary)
                .disabled(isUpdating)
                .sensoryFeedback(.success, trigger: isKept)
            }
            if let updateError {
                Label(updateError, systemImage: "exclamationmark.triangle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
    }

    private func update() {
        guard !isUpdating else { return }
        isUpdating = true
        updateError = nil
        Task {
            do {
                try await store.setPrincipleStatus(for: imprint, status: isKept ? "candidate" : "active")
            } catch {
                updateError = "This takeaway could not be updated. Try again."
            }
            isUpdating = false
        }
    }
}
