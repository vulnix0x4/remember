import SwiftUI

struct SaveSomethingButton: View {
    let action: () -> Void

    var body: some View {
        Button("Save", systemImage: "plus", action: action)
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(RememberDesign.accent)
            .foregroundStyle(RememberDesign.accentInk)
            .frame(minHeight: 44)
            .accessibilityLabel("Save something")
            .accessibilityHint("Opens a sheet where you can paste a link")
    }
}
