import SwiftUI

/// Patterns sub-sections as one row of scrollable chips.
struct PatternSectionControl: View {
    @Binding var selection: EvolutionSection

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: RememberDesign.spacingSmall) {
                ForEach(EvolutionSection.allCases) { section in
                    let isSelected = selection == section
                    Button {
                        selection = section
                    } label: {
                        Text(section.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(isSelected ? RememberDesign.canvas : .white)
                            .padding(.horizontal, RememberDesign.spacing)
                            .frame(minHeight: 40)
                            .background(isSelected ? RememberDesign.primaryFill : RememberDesign.card, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .accessibilityIdentifier("remember.pattern.sections")
        .sensoryFeedback(.selection, trigger: selection)
    }
}
