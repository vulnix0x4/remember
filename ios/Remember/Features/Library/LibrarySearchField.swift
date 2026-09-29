import SwiftUI

struct LibrarySearchField: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: RememberDesign.spacingSmall) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RememberDesign.secondaryText)
                .accessibilityHidden(true)
            TextField("Search your library", text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button("Clear search", systemImage: "xmark.circle.fill") {
                    text = ""
                }
                .labelStyle(.iconOnly)
                .foregroundStyle(RememberDesign.secondaryText)
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .frame(minHeight: 48)
        .background(RememberDesign.card, in: Capsule())
    }
}
