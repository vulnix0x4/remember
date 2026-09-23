import SwiftUI

struct LifeFloorComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var title = ""
    @State private var area = LifeArea.health
    @State private var target = 1
    @State private var unit = "time"
    @State private var unitChoice = "time"
    @State private var isSaving = false
    @State private var submissionError: String?
    @State private var detailsAreExpanded = false
    @AccessibilityFocusState private var submissionErrorIsFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                SheetTitleRow(title: "Add daily basic")
                if let submissionError {
                    Section {
                        Label(submissionError, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(RememberDesign.danger)
                            .accessibilityFocused($submissionErrorIsFocused)
                    }
                    .listRowBackground(RememberDesign.card)
                }
                Section {
                    TextField("Take medication", text: $title)
                        .font(.title3.weight(.semibold))
                        .accessibilityLabel("Daily basic")
                }
                .listRowBackground(RememberDesign.card)
                if detailsAreExpanded {
                    Section("Area") {
                        ChoiceButtonGroup(selection: $area, choices: LifeArea.allCases, minimumButtonWidth: 132) { choice in
                            Label(choice.label, systemImage: choice.symbol)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init())
                    }
                    Section("How much") {
                        Stepper("Target: \(target)", value: $target, in: 1...100)
                            .listRowBackground(RememberDesign.card)
                        ChoiceButtonGroup(selection: $unitChoice, choices: unitChoices + ["custom"], minimumButtonWidth: 104) { choice in
                            Text(choice.capitalized)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init(top: RememberDesign.spacingSmall, leading: 0, bottom: 0, trailing: 0))
                        if unitChoice == "custom" {
                            TextField("Miles, doses, servings…", text: $unit)
                                .accessibilityLabel("Custom unit")
                                .listRowBackground(RememberDesign.card)
                        }
                    }
                } else {
                    Button("Add details", systemImage: "plus") {
                        withAnimation(.snappy(duration: 0.2)) { detailsAreExpanded = true }
                    }
                    .buttonStyle(.rememberQuiet)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
                }
            }
            .rememberFormStyle()
            .disabled(isSaving)
            .rememberPrimaryFooter(isEnabled: isValid && !isSaving, action: save) {
                if isSaving { ProgressView().tint(RememberDesign.canvas) } else { Text("Add daily basic") }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: dismiss.callAsFunction)
                        .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onChange(of: unitChoice) { _, choice in
                unit = choice == "custom" ? "" : choice
            }
        }
        .rememberSheetPresentation()
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var unitChoices: [String] {
        ["time", "minutes", "glasses", "pages", "steps"]
    }

    private func save() {
        guard !isSaving, isValid else { return }
        isSaving = true
        submissionError = nil
        submissionErrorIsFocused = false
        Task {
            let succeeded = await store.createLifeFloorItem(title: title, area: area, target: target, unit: unit)
            isSaving = false
            if succeeded {
                dismiss()
            } else {
                submissionError = "Couldn’t add this. Your details are still here."
                submissionErrorIsFocused = true
            }
        }
    }
}
