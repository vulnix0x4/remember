import SwiftUI

struct ChoiceButtonGroup<Value: Hashable, ChoiceLabel: View>: View {
    @Binding var selection: Value
    let choices: [Value]
    let minimumButtonWidth: CGFloat
    let label: (Value) -> ChoiceLabel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(
        selection: Binding<Value>,
        choices: [Value],
        minimumButtonWidth: CGFloat = 120,
        @ViewBuilder label: @escaping (Value) -> ChoiceLabel
    ) {
        _selection = selection
        self.choices = choices
        self.minimumButtonWidth = minimumButtonWidth
        self.label = label
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: RememberDesign.spacingSmall) {
            ForEach(choices, id: \.self) { choice in
                let isSelected = selection == choice
                Button {
                    selection = choice
                } label: {
                    HStack(spacing: RememberDesign.spacingSmall) {
                        label(choice)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        if isSelected {
                            Image(systemName: "checkmark")
                                .accessibilityHidden(true)
                        }
                    }
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(isSelected ? RememberDesign.accentInk : .primary)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, RememberDesign.spacingCompact)
                    .contentShape(.rect)
                    .background(
                        isSelected ? RememberDesign.accent : RememberDesign.surfaceRaised,
                        in: .rect(cornerRadius: RememberDesign.controlRadius)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: RememberDesign.controlRadius)
                            .stroke(isSelected ? RememberDesign.accent : RememberDesign.line, lineWidth: isSelected ? 2 : 1)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
                .accessibilityValue(isSelected ? "Selected" : "Not selected")
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }

    private var columns: [GridItem] {
        if dynamicTypeSize.isAccessibilitySize {
            return [GridItem(.flexible())]
        }
        return [GridItem(.adaptive(minimum: minimumButtonWidth), spacing: RememberDesign.spacingSmall)]
    }
}
