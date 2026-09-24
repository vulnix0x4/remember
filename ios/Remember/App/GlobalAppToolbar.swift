import SwiftUI

private struct PrimaryScreenModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            // Root screens draw their own large title and avatar (RememberHeader), so the system bar stays out of the way.
            .toolbar(.hidden, for: .navigationBar)
            .background(RememberDesign.canvas)
    }
}

extension View {
    func rememberPrimaryActions() -> some View {
        modifier(PrimaryScreenModifier())
    }
}
