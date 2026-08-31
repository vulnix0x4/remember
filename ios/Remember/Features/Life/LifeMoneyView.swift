import SwiftUI

struct LifeMoneyView: View {
    @Environment(AppStore.self) private var store
    @State private var accountComposerIsPresented = false
    @State private var transactionComposerIsPresented = false

    private var netWorth: Double {
        store.lifeSnapshot.accounts.reduce(0) { total, account in
            total + (["credit", "loan"].contains(account.type) ? -abs(account.balance) : account.balance)
        }
    }

    private var monthSpend: Double {
        let calendar = Calendar.current
        return abs(store.lifeSnapshot.transactions.filter { calendar.isDate($0.occurredAt, equalTo: .now, toGranularity: .month) && $0.amount < 0 }.reduce(0) { $0 + $1.amount })
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("MONEY").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                                Text("Know where you stand.").font(.largeTitle.bold())
                                Text("A calm private ledger for balances, spending, and decisions.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                            }
                            Spacer()
                            Menu("Add", systemImage: "plus") {
                                Button("Account", systemImage: "wallet.bifold") { accountComposerIsPresented = true }
                                Button("Transaction", systemImage: "arrow.left.arrow.right") { transactionComposerIsPresented = true }
                            }
                            .buttonStyle(.borderedProminent)
                            .buttonBorderShape(.capsule)
                            .tint(RememberDesign.accent)
                            .foregroundStyle(RememberDesign.accentInk)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("NET WORTH").font(.caption2.bold()).foregroundStyle(RememberDesign.secondaryText)
                            Text(netWorth, format: .currency(code: "USD").precision(.fractionLength(0)))
                                .font(.system(size: 48, weight: .bold, design: .rounded))
                            Text(store.lifeSnapshot.accounts.isEmpty ? "Add your first account to begin." : "Across \(store.lifeSnapshot.accounts.count) accounts")
                                .font(.caption).foregroundStyle(RememberDesign.secondaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 220, alignment: .bottomLeading)
                        .padding(22)
                        .background(RadialGradient(colors: [RememberDesign.accent.opacity(0.14), RememberDesign.surface], center: .topTrailing, startRadius: 0, endRadius: 300), in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                        HStack(spacing: 10) {
                            summary("Spent this month", value: monthSpend, symbol: "arrow.down.right")
                            summary("Accounts", value: Double(store.lifeSnapshot.accounts.count), symbol: "wallet.bifold", currency: false)
                        }
                        if store.lifeSnapshot.accounts.isEmpty {
                            ContentUnavailableView("No accounts yet", systemImage: "wallet.bifold", description: Text("Manual accounts and connected providers use the same private ledger."))
                                .frame(maxWidth: .infinity, minHeight: 230)
                        } else {
                            Text("ACCOUNTS").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                            ForEach(store.lifeSnapshot.accounts) { account in
                                HStack {
                                    Image(systemName: "creditcard").foregroundStyle(RememberDesign.accent).frame(width: 32)
                                    VStack(alignment: .leading) {
                                        Text(account.name).font(.subheadline.bold())
                                        Text(account.institution.isEmpty ? account.type.capitalized : account.institution).font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                    }
                                    Spacer()
                                    Text(account.balance, format: .currency(code: account.currency)).font(.subheadline.bold())
                                }
                                .padding(.vertical, 8)
                                Divider().overlay(RememberDesign.line)
                            }
                        }
                        if !store.lifeSnapshot.transactions.isEmpty {
                            Text("RECENT ACTIVITY").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                            ForEach(store.lifeSnapshot.transactions.prefix(20)) { transaction in
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(transaction.merchant.isEmpty ? transaction.name : transaction.merchant).font(.subheadline.bold())
                                        Text("\(transaction.category) · \(transaction.occurredAt.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                    }
                                    Spacer()
                                    Text(transaction.amount, format: .currency(code: transaction.currency)).font(.subheadline.bold()).foregroundStyle(transaction.amount > 0 ? RememberDesign.accent : .primary)
                                }
                                .padding(.vertical, 8)
                                Divider().overlay(RememberDesign.line)
                            }
                        }
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .refreshable { await store.loadLife() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $accountComposerIsPresented) { FinanceAccountComposerView() }
            .sheet(isPresented: $transactionComposerIsPresented) { FinanceTransactionComposerView() }
        }
    }

    private func summary(_ title: String, value: Double, symbol: String, currency: Bool = true) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Image(systemName: symbol).foregroundStyle(RememberDesign.accent)
            Spacer()
            Text(title).font(.caption2).foregroundStyle(RememberDesign.secondaryText)
            if currency { Text(value, format: .currency(code: "USD").precision(.fractionLength(0))).font(.title3.bold()) }
            else { Text(Int(value).formatted()).font(.title3.bold()) }
        }
        .frame(maxWidth: .infinity, minHeight: 130, alignment: .leading)
        .padding(16)
        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 17))
    }
}

private struct FinanceAccountComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var name = ""
    @State private var institution = ""
    @State private var type = "checking"
    @State private var balance = 0.0
    private let types = ["checking", "savings", "credit", "investment", "cash", "loan", "other"]

    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section("Account") {
                    TextField("Name", text: $name)
                    TextField("Institution", text: $institution)
                    Picker("Type", selection: $type) { ForEach(types, id: \.self) { Text($0.capitalized).tag($0) } }
                }
                SwiftUI.Section("Current balance") { TextField("0.00", value: $balance, format: .number).keyboardType(.decimalPad) }
            }
            .navigationTitle("Add account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: dismiss.callAsFunction) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await store.addFinanceAccount(name: name, institution: institution, type: type, balance: balance); dismiss() } }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private struct FinanceTransactionComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var name = ""
    @State private var amount = 0.0
    @State private var category = "Uncategorized"
    @State private var accountId: UUID?

    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section {
                    TextField("Name or merchant", text: $name)
                    TextField("Amount", value: $amount, format: .number).keyboardType(.numbersAndPunctuation)
                    TextField("Category", text: $category)
                } header: {
                    Text("Movement")
                } footer: {
                    Text("Use a negative amount for spending and a positive amount for income.")
                }
                if !store.lifeSnapshot.accounts.isEmpty {
                    SwiftUI.Section("Account") {
                        Picker("Account", selection: $accountId) {
                            Text("No account").tag(Optional<UUID>.none)
                            ForEach(store.lifeSnapshot.accounts) { Text($0.name).tag(Optional($0.id)) }
                        }
                    }
                }
            }
            .navigationTitle("Add transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: dismiss.callAsFunction) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await store.addFinanceTransaction(accountId: accountId, name: name, amount: amount, category: category); dismiss() } }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
