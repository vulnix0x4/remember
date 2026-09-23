import SwiftUI

struct AdaptiveSectionControl<Value: Hashable>: View {
    @Binding var selection: Value
    let choices: [Value]
    let accessibilityIdentifier: String
    let title: (Value) -> String
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                ScrollView(.horizontal) {
                    HStack(spacing: RememberDesign.spacingSmall) {
                        ForEach(choices, id: \.self) { choice in
                            let isSelected = selection == choice
                            Button {
                                selection = choice
                            } label: {
                                HStack(spacing: RememberDesign.spacingSmall) {
                                    Text(title(choice))
                                    if isSelected {
                                        Image(systemName: "checkmark")
                                            .accessibilityHidden(true)
                                    }
                                }
                            }
                            .font(.headline)
                            .foregroundStyle(isSelected ? RememberDesign.accentInk : .primary)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
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
                            .accessibilityLabel(title(choice))
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                            .accessibilityValue(isSelected ? "Selected" : "Not selected")
                        }
                    }
                }
                .scrollIndicators(.hidden)
            } else {
                Picker("Section", selection: $selection) {
                    ForEach(choices, id: \.self) { choice in
                        Text(title(choice)).tag(choice)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.vertical, RememberDesign.spacingSmall)
        .accessibilityIdentifier(accessibilityIdentifier)
        .sensoryFeedback(.selection, trigger: selection)
    }
}
