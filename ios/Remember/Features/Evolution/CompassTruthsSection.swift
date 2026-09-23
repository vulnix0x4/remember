import SwiftUI

struct CompassTruthsSection: View {
    let principles: [EvolutionPrinciple]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "True for now")

            if principles.isEmpty {
                Text("Nothing kept yet. Keep a takeaway when it fits.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
            } else {
                ForEach(principles) { principle in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(principle.text)
                            .font(.rememberRowTitle)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 0) {
                            if let imprint = imprint(for: principle.itemId) {
                                NavigationLink(value: imprint) {
                                    Label("What shaped this", systemImage: "bookmark")
                                }
                                .buttonStyle(.rememberQuiet)
                            }
                            Spacer(minLength: 0)
                            Button("Release", action: { release(principle) })
                                .buttonStyle(.rememberQuiet)
                                .disabled(workingID != nil)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
                }
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
    }

    private func imprint(for id: String) -> Imprint? {
        guard let itemID = UUID(uuidString: id) else { return nil }
        return store.imprint(withID: itemID)
    }

    private func release(_ principle: EvolutionPrinciple) {
        update(principle, status: "candidate")
    }

    private func update(_ principle: EvolutionPrinciple, status: String) {
        guard workingID == nil else { return }
        workingID = principle.id
        errorMessage = nil
        Task {
            do {
                try await store.setPrincipleStatus(principle, status: status)
            } catch {
                errorMessage = "Couldn’t save that. Try again."
            }
            workingID = nil
        }
    }
}
