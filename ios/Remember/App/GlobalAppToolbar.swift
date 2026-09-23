import SwiftUI

private struct PrimaryActionsModifier: ViewModifier {
    @Environment(AppStore.self) private var store

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Profile and settings", systemImage: "person.crop.circle") {
                        store.selectedTab = .settings
                    }
                    .accessibilityIdentifier("remember.global.settings")
                    .accessibilityHint("Opens account, appearance, and data settings")
                }
            }
    }
}

extension View {
    func rememberPrimaryActions() -> some View {
        modifier(PrimaryActionsModifier())
    }
}
