import SwiftUI

struct RememberMark: View {
    var size: CGFloat = 38

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.29, style: .continuous)
                .fill(RememberDesign.surfaceRaised)
            Circle()
                .trim(from: 0.08, to: 0.9)
                .stroke(RememberDesign.accent, style: .init(lineWidth: size * 0.07, lineCap: .round))
                .padding(size * 0.19)
                .rotationEffect(.degrees(-34))
            Circle()
                .trim(from: 0.1, to: 0.82)
                .stroke(RememberDesign.secondaryText.opacity(0.8), style: .init(lineWidth: size * 0.055, lineCap: .round))
                .padding(size * 0.31)
                .rotationEffect(.degrees(24))
            Circle()
                .fill(RememberDesign.accent)
                .frame(width: size * 0.12, height: size * 0.12)
        }
        .frame(width: size, height: size)
        .overlay { RoundedRectangle(cornerRadius: size * 0.29).stroke(RememberDesign.line.opacity(0.55)) }
        .accessibilityHidden(true)
    }
}
