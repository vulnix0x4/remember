import SwiftUI

struct CompassTruthsSection: View {
    let principles: [EvolutionPrinciple]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("TRUE FOR NOW")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(RememberDesign.secondaryText)
                Text("Ideas you chose to keep")
                    .font(.title2)
                    .bold()
            }

            if principles.isEmpty {
                ContentUnavailableView(
                    "Nothing is fixed here",
                    systemImage: "compass.drawing",
                    description: Text("Keep a takeaway when it earns a place in how you want to live.")
                )
            } else {
                ForEach(principles) { principle in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                        Text(principle.text)
                            .font(.title3)
                            .bold()
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: RememberDesign.spacingSmall) {
                            if let imprint = imprint(for: principle.itemId) {
                                NavigationLink(value: imprint) {
                                    Label("What shaped this", systemImage: "bookmark")
                                }
                                .buttonStyle(.bordered)
                            }
                            Button("Release", systemImage: "minus", action: { release(principle) })
                                .buttonStyle(.bordered)
                                .disabled(workingID != nil)
                        }
                    }
                    .padding(.vertical, RememberDesign.spacingSmall)
                    Divider()
                }
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
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
                errorMessage = "That choice could not be saved. Try again."
            }
            workingID = nil
        }
    }
}
