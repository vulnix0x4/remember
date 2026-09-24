import SwiftUI

/// One row of filter chips, always visible. The last chip flips the sort order.
struct LibraryFilterBar: View {
    @Binding var filter: LibraryFilter
    @Binding var newestFirst: Bool

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: RememberDesign.spacingSmall) {
                ForEach(LibraryFilter.allCases) { option in
                    let isSelected = filter == option
                    Button {
                        filter = option
                    } label: {
                        Text(option == .all ? "All" : option.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(isSelected ? RememberDesign.canvas : .white)
                            .padding(.horizontal, RememberDesign.spacing)
                            .frame(minHeight: 40)
                            .background(isSelected ? RememberDesign.primaryFill : RememberDesign.card, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
                Button {
                    newestFirst.toggle()
                } label: {
                    Label(newestFirst ? "Newest" : "Oldest", systemImage: "arrow.up.arrow.down")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(RememberDesign.text2)
                        .padding(.horizontal, RememberDesign.spacing)
                        .frame(minHeight: 40)
                        .background(RememberDesign.card, in: .capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(newestFirst ? "Sorted newest first" : "Sorted oldest first")
                .accessibilityHint("Changes the order of saved items")
            }
            .padding(.horizontal, RememberDesign.spacing)
        }
        .scrollIndicators(.hidden)
        .padding(.vertical, RememberDesign.spacingSmall)
        .accessibilityIdentifier("remember.library.filter")
        .sensoryFeedback(.selection, trigger: filter)
    }
}
