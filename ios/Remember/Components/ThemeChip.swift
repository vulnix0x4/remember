import SwiftUI

struct ThemeChip: View {
    let name: String
    var emphasized = false

    var body: some View {
        Text(name)
            .font(emphasized ? .subheadline.weight(.semibold) : .rememberMeta)
            .foregroundStyle(emphasized ? .white : RememberDesign.text2)
            .padding(.horizontal, emphasized ? 14 : 12)
            .frame(minHeight: emphasized ? 36 : 30)
            .background(RememberDesign.cardRaised, in: .capsule)
            .accessibilityLabel("Theme: \(name)")
    }
}
