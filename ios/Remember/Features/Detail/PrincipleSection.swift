import SwiftUI

struct PrincipleSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var isUpdating = false
    @State private var updateError: String?

    private var isKept: Bool { imprint.principleStatus == "active" }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "", title: "Takeaway")
            if let principle = imprint.candidatePrinciples.first {
                Label(principle, systemImage: "compass.drawing")
                    .font(.headline)
            }
            if imprint.principleID != nil {
                Button(isKept ? "Remove takeaway" : "Keep takeaway", systemImage: isKept ? "minus" : "plus") {
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
        .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
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
