import SwiftUI

struct WarmBackground: View {
    var body: some View {
        ZStack {
            RememberDesign.canvas
            RadialGradient(
                colors: [RememberDesign.accent.opacity(0.12), .clear],
                center: UnitPoint(x: 0.78, y: -0.08),
                startRadius: 0,
                endRadius: 440
            )
            RadialGradient(
                colors: [RememberDesign.accent.opacity(0.055), .clear],
                center: UnitPoint(x: 0.05, y: 0.92),
                startRadius: 0,
                endRadius: 360
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
