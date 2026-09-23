import SwiftUI

struct ReturnCuePicker: View {
    let selection: ReturnCue?
    let returnDate: Date
    let onSelect: (ReturnCue?) -> Void
    let onDateChange: (Date) -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("Bring this back…")
                    .font(.subheadline.bold())
                Text("Optional. Give this idea a useful future moment.")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
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
                        .foregroundStyle(isSelected ? RememberDesign.accentInk : .primary)
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .padding(.horizontal, RememberDesign.spacingCompact)
                        .contentShape(.rect)
                        .background(isSelected ? RememberDesign.accent : RememberDesign.surfaceRaised, in: .rect(cornerRadius: RememberDesign.controlRadius))
                        .overlay { RoundedRectangle(cornerRadius: RememberDesign.controlRadius).stroke(isSelected ? RememberDesign.accent : RememberDesign.line, lineWidth: isSelected ? 2 : 1) }
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
