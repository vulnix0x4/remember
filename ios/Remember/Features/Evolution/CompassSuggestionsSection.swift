import SwiftUI

struct CompassSuggestionsSection: View {
    let principles: [EvolutionPrinciple]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Keep this?")

            ForEach(principles) { principle in
                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    Text(principle.text)
                        .font(.rememberRowTitle)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: RememberDesign.spacingSmall) {
                        Button("Keep", systemImage: "checkmark", action: { update(principle, status: "active") })
                            .buttonStyle(.rememberSecondary)
                        Button("Not for me", action: { update(principle, status: "dismissed") })
                            .buttonStyle(.rememberQuiet)
                    }
                    .disabled(workingID != nil)
                    if let imprint = imprint(for: principle.itemId) {
                        NavigationLink(value: imprint) {
                            Label("See the source", systemImage: "bookmark")
                        }
                        .buttonStyle(.rememberQuiet)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)
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
