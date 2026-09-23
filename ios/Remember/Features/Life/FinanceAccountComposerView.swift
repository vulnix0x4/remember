import SwiftUI

struct FinanceAccountComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var name = ""
    @State private var institution = ""
    @State private var type = "checking"
    @State private var balance = 0.0
    @State private var currency = Locale.current.currency?.identifier ?? "USD"
    @State private var isSaving = false
    @State private var submissionError: String?
    @AccessibilityFocusState private var submissionErrorIsFocused: Bool
    private let types = ["checking", "savings", "credit", "investment", "cash", "loan", "other"]

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
                Section("Account") {
                    TextField("Name", text: $name)
                    TextField("Institution", text: $institution)
                }
                Section("Type") {
                    ChoiceButtonGroup(selection: $type, choices: types, minimumButtonWidth: 120) { choice in
                        Label(choice.capitalized, systemImage: symbol(for: choice))
                    }
                }
                Section("Current balance") {
                    TextField("0.00", value: $balance, format: .number)
                        .keyboardType(.decimalPad)
                    CurrencySelectionRow(currency: $currency)
                }
            }
            .disabled(isSaving)
            .navigationTitle("Add account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if isSaving {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text("Add")
                        }
                    }
                        .accessibilityLabel(isSaving ? "Adding account" : "Add account")
                        .disabled(!isValid || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() {
        guard !isSaving, isValid else { return }
        isSaving = true
        submissionError = nil
        submissionErrorIsFocused = false
        Task {
            let succeeded = await store.addFinanceAccount(name: name, institution: institution, type: type, balance: balance, currency: currency)
            isSaving = false
            if succeeded {
                dismiss()
            } else {
                submissionError = "Couldn’t add this account. Check your connection and try again. Your account details are still here."
                submissionErrorIsFocused = true
            }
        }
    }

    private func symbol(for type: String) -> String {
        switch type {
        case "checking": "building.columns"
        case "savings": "banknote"
        case "credit": "creditcard"
        case "investment": "chart.line.uptrend.xyaxis"
        case "cash": "dollarsign.circle"
        case "loan": "doc.text"
        default: "wallet.bifold"
        }
    }
}
