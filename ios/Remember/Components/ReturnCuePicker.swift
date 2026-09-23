import SwiftUI

struct ReturnCuePicker: View {
    let selection: ReturnCue?
    let returnDate: Date
    let onSelect: (ReturnCue?) -> Void
    let onDateChange: (Date) -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            LazyVGrid(columns: columns, spacing: RememberDesign.spacingSmall) {
                ForEach(ReturnCue.allCases) { cue in
                    let isSelected = selection == cue
                    Button { onSelect(isSelected ? nil : cue) } label: {
                        HStack(spacing: RememberDesign.spacingSmall) {
                            Image(systemName: cue.systemImage).frame(width: 20)
                            Text(cue.label).lineLimit(2)
                            Spacer(minLength: 0)
                            if isSelected { Image(systemName: "checkmark").accessibilityHidden(true) }
                        }
                        .font(.subheadline.bold())
                        .foregroundStyle(isSelected ? RememberDesign.canvas : .white)
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .padding(.horizontal, RememberDesign.spacing)
                        .contentShape(.capsule)
                        .background(isSelected ? RememberDesign.primaryFill : RememberDesign.cardRaised, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                    .accessibilityIdentifier("remember.return-cue.\(cue.rawValue)")
                }
            }
            if selection == .date {
                DatePicker("Choose a day", selection: Binding(get: { returnDate }, set: onDateChange), in: Calendar.current.startOfDay(for: .now)..., displayedComponents: .date)
                    .datePickerStyle(.compact)
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.adaptive(minimum: 142), spacing: RememberDesign.spacingSmall)]
    }
}
