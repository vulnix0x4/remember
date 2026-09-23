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
                if let submissionError {
                    Section {
                        Label(submissionError, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(RememberDesign.danger)
                            .accessibilityFocused($submissionErrorIsFocused)
                        Button("Try again", systemImage: "arrow.clockwise", action: save)
                            .disabled(!isValid)
                    }
                }
                Section("Daily basic") {
                    TextField("Take medication", text: $title)
                }
                Section {
                    DisclosureGroup(isExpanded: $detailsAreExpanded) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                            ChoiceButtonGroup(selection: $area, choices: LifeArea.allCases, minimumButtonWidth: 132) { choice in
                                Label(choice.label, systemImage: choice.symbol)
                            }
                            Stepper("Target: \(target)", value: $target, in: 1...100)
                            ChoiceButtonGroup(selection: $unitChoice, choices: unitChoices + ["custom"], minimumButtonWidth: 104) { choice in
                                Text(choice.capitalized)
                            }
                            if unitChoice == "custom" {
                                TextField("Miles, doses, servings…", text: $unit)
                                    .accessibilityLabel("Custom unit")
                            }
                        }
                        .padding(.top, RememberDesign.spacing)
                    } label: {
                        Text("Add details")
                    }
                }
            }
            .disabled(isSaving)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Button(action: save) {
                    Group {
                        if isSaving { ProgressView() }
                        else { Text("Add daily basic").font(.body.weight(.semibold)) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 54)
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
                .disabled(!isValid || isSaving)
                .padding(RememberDesign.spacing)
                .background(.regularMaterial)
            }
            .navigationTitle("Add daily basic")
            .navigationBarTitleDisplayMode(.inline)
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
                submissionError = "Couldn’t add this daily basic. Check your connection and try again. Your details are still here."
                submissionErrorIsFocused = true
            }
        }
    }
}
