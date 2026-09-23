import SwiftUI

struct IntentionalReturnCard: View {
    let imprint: Imprint
    let cue: ReturnCue
    var onReflectionSaved: () -> Void = {}
    @Environment(AppStore.self) private var store
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("You asked Remember to keep this for")
                    .font(.subheadline.bold())
                    .foregroundStyle(RememberDesign.accent)
                    .accessibilityIdentifier("remember.today.intentional-return")
                Text(cue.label).font(.title2.bold())
            }
            Divider()
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(imprint.essence).font(.title3.bold())
                Text(cue.reason).foregroundStyle(RememberDesign.secondaryText)
                Label(imprint.title, systemImage: "books.vertical").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
            }
            MemoryCheckIn(imprint: imprint, onSaved: onReflectionSaved)
            actionLayout {
                NavigationLink(value: imprint) { Label("Open saved item", systemImage: "arrow.right").frame(maxWidth: .infinity, minHeight: 44) }
                    .buttonStyle(.borderedProminent).tint(RememberDesign.accent).foregroundStyle(RememberDesign.accentInk)
                Button("Work with this in Ask", systemImage: "bubble.left.and.text.bubble.right", action: exploreInAsk)
                    .buttonStyle(.bordered).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonBorderShape(.roundedRectangle(radius: RememberDesign.controlRadius))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberSurface()
    }

    private var actionLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: RememberDesign.spacingSmall)) : AnyLayout(HStackLayout(spacing: RememberDesign.spacingSmall))
    }

    private func exploreInAsk() { store.askDraft = cue.question(for: imprint); store.selectedTab = .ask }
}
