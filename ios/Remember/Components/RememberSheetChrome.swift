import SwiftUI

/// Shared look for form-style sheets: canvas background, card rows, large left title,
/// and one white primary button pinned at the bottom.
extension View {
    func rememberSheetPresentation() -> some View {
        self
            .presentationDragIndicator(.visible)
            .presentationBackground(RememberDesign.canvas)
            .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    /// Restyles a grouped `Form` to the redesign tokens.
    func rememberFormStyle() -> some View {
        self
            .scrollContentBackground(.hidden)
            .background(RememberDesign.canvas)
    }

    /// Pins the sheet's single primary action above the keyboard/home indicator.
    func rememberPrimaryFooter<Label: View>(
        isEnabled: Bool,
        accessibilityIdentifier: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) -> some View {
        let label = label()
        return safeAreaInset(edge: .bottom, spacing: 0) {
            Button(action: action) { label }
                .buttonStyle(.rememberPrimary)
                .disabled(!isEnabled)
                .accessibilityIdentifier(accessibilityIdentifier ?? "remember.sheet.primary")
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.vertical, RememberDesign.spacingSmall)
                .background(RememberDesign.canvas)
        }
    }
}

/// Large, left-aligned sheet title that sits in a `Form` without a card behind it.
struct SheetTitleRow: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.rememberHero)
            .foregroundStyle(RememberDesign.text)
            .accessibilityAddTraits(.isHeader)
            .listRowBackground(Color.clear)
            .listRowInsets(.init(top: 0, leading: RememberDesign.spacingXXSmall, bottom: 0, trailing: 0))
    }
}
