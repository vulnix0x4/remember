import SwiftUI

/// A one-line status under the Today title. Tapping it opens Jev's settings.
struct JevStatusLine: View {
    @Environment(AppStore.self) private var store
    private var isOn: Bool { store.brain?.settings.enabled == true }

    var body: some View {
        Button {
            store.selectedTab = .settings
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(isOn ? RememberDesign.accent : RememberDesign.text3)
                    .frame(width: 8, height: 8)
                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isOn ? .white : RememberDesign.text2)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RememberDesign.text3)
            }
            .frame(minHeight: 36)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens Settings, where you set up your day")
        .accessibilityIdentifier("remember.jev.status")
    }

    private var label: String {
        if store.brainError != nil { return "Jev can’t reach your plan right now" }
        guard let brain = store.brain else { return "Jev isn’t connected yet" }
        if store.isUpdatingBrain { return "Jev is updating your plan…" }
        return brain.settings.enabled ? "Jev is planning your day" : "Jev is paused"
    }
}
