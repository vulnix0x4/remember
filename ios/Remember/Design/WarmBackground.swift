import SwiftUI

struct WarmBackground: View {
    var body: some View {
        RememberDesign.canvas
            .ignoresSafeArea()
            .accessibilityHidden(true)
    }
}
