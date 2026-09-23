import SwiftUI

struct SearchableChoiceSheet<Value: Hashable>: View {
    let title: String
    let choices: [Value]
    @Binding var selection: Value
    let label: (Value) -> String
    let detail: (Value) -> String?
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    init(
        title: String,
        choices: [Value],
        selection: Binding<Value>,
        label: @escaping (Value) -> String,
        detail: @escaping (Value) -> String? = { _ in nil }
    ) {
        self.title = title
        self.choices = choices
        _selection = selection
        self.label = label
        self.detail = detail
    }

    var body: some View {
        NavigationStack {
            Group {
                if filteredChoices.isEmpty {
                    RememberEmptyState(systemImage: "magnifyingglass", title: "No results", message: "Try a different word.")
                        .frame(maxHeight: .infinity, alignment: .top)
                } else {
                    List(filteredChoices, id: \.self) { choice in
                        Button {
                            selection = choice
                            dismiss()
                        } label: {
                            HStack(spacing: RememberDesign.spacingCompact) {
                                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                                    Text(label(choice))
                                        .foregroundStyle(.primary)
                                    if let detail = detail(choice), !detail.isEmpty {
                                        Text(detail)
                                            .font(.subheadline)
                                            .foregroundStyle(RememberDesign.secondaryText)
                                    }
                                }
                                Spacer()
                                if selection == choice {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(RememberDesign.accent)
                                        .accessibilityHidden(true)
                                }
                            }
                            .frame(minHeight: 44)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(RememberDesign.line)
                        .accessibilityAddTraits(selection == choice ? .isSelected : [])
                        .accessibilityValue(selection == choice ? "Selected" : "Not selected")
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(RememberDesign.canvas)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Search \(title.lowercased())")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private var filteredChoices: [Value] {
        guard !searchText.isEmpty else { return choices }
        return choices.filter { choice in
            let searchableText = [label(choice), detail(choice) ?? ""].joined(separator: " ")
            return searchableText.localizedStandardContains(searchText)
        }
    }
}
