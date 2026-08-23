import SwiftUI

struct ThemeChip: View {
    let name: String
    var emphasized = false

    var body: some View {
        Text(name)
            .font(emphasized ? .headline : .subheadline)
            .padding(.horizontal, emphasized ? 18 : 14)
            .padding(.vertical, emphasized ? 12 : 9)
            .background(emphasized ? RememberDesign.accent : Color.secondary.opacity(0.12), in: .capsule)
            .foregroundStyle(emphasized ? .white : .primary)
            .accessibilityLabel("Theme: \(name)")
    }
}
