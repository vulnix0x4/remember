import SwiftUI

struct IntentionalReturnCard: View {
    let imprint: Imprint
    let cue: ReturnCue
    var onReflectionSaved: () -> Void = {}
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text(cue.label)
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text2)
                .accessibilityIdentifier("remember.today.intentional-return")
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text(imprint.essence)
                    .font(.rememberSectionTitle)
                    .fixedSize(horizontal: false, vertical: true)
                Text(imprint.title)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .lineLimit(1)
            }
            NavigationLink(value: imprint) {
                Label("Open saved item", systemImage: "arrow.right")
            }
            .buttonStyle(.rememberSecondary)
            Button("Ask about this", action: exploreInAsk)
                .buttonStyle(.rememberQuiet)
            MemoryCheckIn(imprint: imprint, onSaved: onReflectionSaved)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing + 4)
    }

    private func exploreInAsk() { store.askDraft = cue.question(for: imprint); store.selectedTab = .ask }
}
