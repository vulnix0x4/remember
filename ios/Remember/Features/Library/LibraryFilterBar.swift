import SwiftUI

struct LibraryFilterBar: View {
    @Binding var filter: LibraryFilter
    @Binding var newestFirst: Bool
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var optionsAreVisible = false

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: RememberDesign.spacingSmall) {
                    filterButton
                    Spacer()
                    sortButton
                }
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    filterButton
                    sortButton
                }
            }
            if optionsAreVisible {
                ScrollView(.horizontal) {
                HStack(spacing: RememberDesign.spacingSmall) {
                    ForEach(LibraryFilter.allCases) { option in
                        let isSelected = filter == option
                        Button {
                            filter = option
                        } label: {
                            HStack(spacing: RememberDesign.spacingSmall) {
                                Text(option.rawValue)
                                if isSelected {
                                    Image(systemName: "checkmark")
                                        .accessibilityHidden(true)
                                }
                            }
                        }
                        .font(.subheadline)
                        .bold()
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .foregroundStyle(isSelected ? RememberDesign.accentInk : .primary)
                        .frame(minHeight: 44)
                        .padding(.horizontal, RememberDesign.spacingCompact)
                        .background(
                            isSelected ? RememberDesign.accent : RememberDesign.surfaceRaised,
                            in: .capsule
                        )
                        .overlay {
                            Capsule()
                                .stroke(isSelected ? RememberDesign.accent : RememberDesign.line, lineWidth: isSelected ? 2 : 1)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(option.rawValue)
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                        .accessibilityValue(isSelected ? "Selected" : "Not selected")
                    }
                }
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.vertical, RememberDesign.spacingSmall)
        .sensoryFeedback(.selection, trigger: filter)
    }

    private var filterButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { optionsAreVisible.toggle() }
        } label: {
            Label(filter == .all ? "All saves" : filter.rawValue, systemImage: "line.3.horizontal.decrease")
                .font(.subheadline.weight(.semibold))
        }
        .buttonStyle(.bordered)
        .frame(minHeight: 44)
        .accessibilityLabel("Filter: \(filter.rawValue)")
        .accessibilityIdentifier("remember.library.filter")
        .accessibilityValue(optionsAreVisible ? "Expanded" : "Collapsed")
    }

    private var sortButton: some View {
        Button {
            newestFirst.toggle()
        } label: {
            Label(
                dynamicTypeSize.isAccessibilitySize
                    ? (newestFirst ? "Newest" : "Oldest")
                    : (newestFirst ? "Newest first" : "Oldest first"),
                systemImage: "arrow.up.arrow.down"
            )
        }
        .buttonStyle(.bordered)
        .controlSize(dynamicTypeSize.isAccessibilitySize ? .regular : .small)
        .frame(minHeight: 44)
        .accessibilityLabel(newestFirst ? "Newest first" : "Oldest first")
        .accessibilityHint("Changes the order of saved items")
    }
}
