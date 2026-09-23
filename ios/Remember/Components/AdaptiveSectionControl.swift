import SwiftUI

struct AdaptiveSectionControl<Value: Hashable>: View {
    @Binding var selection: Value
    let choices: [Value]
    let accessibilityIdentifier: String
    let title: (Value) -> String
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Namespace private var namespace

    /// Every sectioned tab shows its tab name as the large title, with the sections as pills below.
    var body: some View {
        RememberHeader(screenTitle) { control }
    }

    private var screenTitle: String {
        (accessibilityIdentifier.split(separator: ".").last.map(String.init) ?? "").capitalized
    }

    private var control: some View {
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
                            .foregroundStyle(isSelected ? RememberDesign.canvas : .white)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            .frame(minHeight: 44)
                            .padding(.horizontal, RememberDesign.spacingCompact)
                            .background(isSelected ? RememberDesign.primaryFill : RememberDesign.card, in: .capsule)
                            .buttonStyle(.plain)
                            .accessibilityLabel(title(choice))
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                            .accessibilityValue(isSelected ? "Selected" : "Not selected")
                        }
                    }
                }
                .scrollIndicators(.hidden)
            } else {
                HStack(spacing: 4) {
                    ForEach(choices, id: \.self) { choice in
                        let isSelected = selection == choice
                        Button {
                            withAnimation(.snappy(duration: 0.2)) { selection = choice }
                        } label: {
                            Text(title(choice))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(isSelected ? RememberDesign.canvas : RememberDesign.text2)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 36)
                                .background {
                                    if isSelected {
                                        Capsule().fill(RememberDesign.primaryFill).matchedGeometryEffect(id: "selection", in: namespace)
                                    }
                                }
                                .contentShape(.capsule)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(title(choice))
                        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
                    }
                }
                .padding(4)
                .background(RememberDesign.card, in: .capsule)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(accessibilityIdentifier)
        .sensoryFeedback(.selection, trigger: selection)
    }
}
