import SwiftUI

struct PatternSectionControl: View {
    @Binding var selection: EvolutionSection
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                ScrollView(.horizontal) {
                    HStack(spacing: RememberDesign.spacingSmall) {
                        ForEach(EvolutionSection.allCases) { section in
                            sectionButton(section, fillsWidth: false)
                        }
                    }
                }
                .scrollIndicators(.hidden)
            } else {
                HStack(spacing: 2) {
                    ForEach(EvolutionSection.allCases) { section in
                        sectionButton(section, fillsWidth: true)
                    }
                }
                .padding(3)
                .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: RememberDesign.controlRadius)
                        .stroke(RememberDesign.line, lineWidth: 1)
                }
            }
        }
        .accessibilityIdentifier("remember.pattern.sections")
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func sectionButton(_ section: EvolutionSection, fillsWidth: Bool) -> some View {
        let isSelected = selection == section
        return Button(section.rawValue) {
            selection = section
        }
        .font(dynamicTypeSize.isAccessibilitySize ? .headline : .caption)
        .fontWeight(.semibold)
        .foregroundStyle(isSelected ? RememberDesign.accentInk : .primary)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .frame(maxWidth: fillsWidth ? .infinity : nil, minHeight: 44)
        .padding(.horizontal, fillsWidth ? 2 : RememberDesign.spacingCompact)
        .background(
            isSelected ? RememberDesign.accent : (dynamicTypeSize.isAccessibilitySize ? RememberDesign.surfaceRaised : .clear),
            in: .rect(cornerRadius: RememberDesign.controlRadius - 2)
        )
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
