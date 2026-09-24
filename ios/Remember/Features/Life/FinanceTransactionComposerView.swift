import SwiftUI

struct FinanceTransactionComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var name = ""
    @State private var amount = 0.0
    @State private var category = "Uncategorized"
    @State private var categoryChoice = "Uncategorized"
    @State private var accountId: UUID?
    @State private var isExpense = true
    @State private var currency = Locale.current.currency?.identifier ?? "USD"
    @State private var isSaving = false
    @State private var submissionError: String?
    @State private var accountSheetIsPresented = false
    @State private var currencySheetIsPresented = false
    @AccessibilityFocusState private var submissionErrorIsFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                SheetTitleRow(title: "Add transaction")
                if let submissionError {
                    Section {
                        Label(submissionError, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(RememberDesign.danger)
                            .accessibilityFocused($submissionErrorIsFocused)
                    }
                    .listRowBackground(RememberDesign.card)
                }
                Section("Transaction") {
                    TextField("Name or merchant", text: $name)
                    ChoiceButtonGroup(selection: $isExpense, choices: [true, false], minimumButtonWidth: 120) { expense in
                        Text(expense ? "Expense" : "Income")
                    }
                    TextField("Amount", value: $amount, format: .number)
                        .keyboardType(.decimalPad)
                    CurrencySelectionRow(
                        currency: $currency,
                        additionalCodes: store.lifeSnapshot.accounts.map(\.currency),
                        isDisabled: accountId != nil
                    ) { currencySheetIsPresented = true }
                }
                .listRowBackground(RememberDesign.card)
                if !store.lifeSnapshot.accounts.isEmpty {
                    Section("Account") {
                        if store.lifeSnapshot.accounts.count <= 4 {
                            ChoiceButtonGroup(selection: $accountId, choices: accountChoices, minimumButtonWidth: 132) { id in
                                Label(accountLabel(for: id), systemImage: id == nil ? "minus.circle" : "wallet.bifold")
                            }
                            .listRowBackground(Color.clear)
                            .listRowInsets(.init())
                        } else {
                            Button {
                                accountSheetIsPresented = true
                            } label: {
                                LabeledContent("Account") {
                                    HStack(spacing: RememberDesign.spacingSmall) {
                                        Text(accountLabel(for: accountId))
                                            .foregroundStyle(.primary)
                                        Image(systemName: "chevron.right")
                                            .font(.footnote)
                                            .foregroundStyle(RememberDesign.tertiaryText)
                                            .accessibilityHidden(true)
                                    }
                                }
                                .contentShape(.rect)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(RememberDesign.card)
                            .accessibilityHint("Opens a searchable account list")
                        }
                    }
                }
                Section("Category") {
                    ChoiceButtonGroup(selection: $categoryChoice, choices: categoryChoices + ["Other"], minimumButtonWidth: 104) { choice in
                        Text(choice)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
                    if categoryChoice == "Other" {
                        TextField("Coffee, travel, subscriptions…", text: $category)
                            .accessibilityLabel("Custom category")
                            .listRowBackground(RememberDesign.card)
                    }
                }
            }
            .rememberFormStyle()
            .disabled(isSaving)
            .rememberPrimaryFooter(isEnabled: isValid && !isSaving, accessibilityIdentifier: "remember.transaction.submit", action: save) {
                if isSaving { ProgressView().tint(RememberDesign.canvas) } else { Text("Save") }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
                        .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onChange(of: accountId) { _, id in
                guard let id,
                      let account = store.lifeSnapshot.accounts.first(where: { $0.id == id }) else { return }
                currency = account.currency
            }
            .onChange(of: categoryChoice) { _, choice in
                category = choice == "Other" ? "" : choice
            }
            .sheet(isPresented: $currencySheetIsPresented) {
                CurrencyChoiceSheet(currency: $currency, additionalCodes: store.lifeSnapshot.accounts.map(\.currency))
            }
            .sheet(isPresented: $accountSheetIsPresented) {
                SearchableChoiceSheet(
                    title: "Account",
                    choices: accountChoices,
                    selection: $accountId,
                    label: accountLabel,
                    detail: accountDetail
                )
            }
        }
        .rememberSheetPresentation()
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && amount > 0
            && !category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var accountChoices: [UUID?] {
        [nil] + store.lifeSnapshot.accounts.map { Optional($0.id) }
    }

    private var categoryChoices: [String] {
        ["Uncategorized", "Food", "Transport", "Shopping", "Housing", "Health", "Entertainment"]
    }

    private func accountLabel(for id: UUID?) -> String {
        guard let id, let account = store.lifeSnapshot.accounts.first(where: { $0.id == id }) else {
            return "No account"
        }
        return account.name
    }

    private func accountDetail(for id: UUID?) -> String? {
        guard let id, let account = store.lifeSnapshot.accounts.first(where: { $0.id == id }) else {
            return "Track this without changing an account balance"
        }
        return [account.institution, account.currency]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private func save() {
        guard !isSaving, isValid else { return }
        isSaving = true
        submissionError = nil
        submissionErrorIsFocused = false
        let signedAmount = isExpense ? -abs(amount) : abs(amount)
        Task {
            let succeeded = await store.addFinanceTransaction(accountId: accountId, name: name, amount: signedAmount, category: category, currency: currency)
            isSaving = false
            if succeeded {
                dismiss()
            } else {
                submissionError = "Couldn’t save this. Your details are still here."
                submissionErrorIsFocused = true
            }
        }
    }
}
