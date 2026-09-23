import SwiftUI

struct CompassSuggestionsSection: View {
    let principles: [EvolutionPrinciple]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("WORTH DECIDING")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(RememberDesign.secondaryText)
                Text("Does this belong in your compass?")
                    .font(.title2)
                    .bold()
                Text("Remember can notice an idea. Only you can decide whether it feels true.")
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            ForEach(principles) { principle in
                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    Text(principle.text)
                        .font(.title3)
                        .bold()
                        .fixedSize(horizontal: false, vertical: true)
                    if let imprint = imprint(for: principle.itemId) {
                        NavigationLink(value: imprint) {
                            Label("Review the source", systemImage: "bookmark")
                        }
                        .buttonStyle(.plain)
                    }
                    HStack(spacing: RememberDesign.spacingSmall) {
                        Button("Keep", systemImage: "checkmark", action: { update(principle, status: "active") })
                            .buttonStyle(.borderedProminent)
                        Button("Not for me", systemImage: "xmark", action: { update(principle, status: "dismissed") })
                            .buttonStyle(.bordered)
                    }
                    .disabled(workingID != nil)
                }
                .padding(.vertical, RememberDesign.spacingSmall)
                Divider()
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
