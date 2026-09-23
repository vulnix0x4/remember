import SwiftUI

struct LifeMoneyView: View {
    @Environment(AppStore.self) private var store
    @Binding private var lifeSection: LifeSection
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var accountComposerIsPresented = false
    @State private var transactionComposerIsPresented = false

    init(lifeSection: Binding<LifeSection> = .constant(.money)) {
        _lifeSection = lifeSection
    }

    private var accountCurrency: String? {
        let values = Set(store.lifeSnapshot.accounts.map(\.currency))
        return values.count == 1 ? values.first : nil
    }

    private var netWorth: Double? {
        guard accountCurrency != nil, !store.lifeSnapshot.accounts.isEmpty else { return nil }
        return store.lifeSnapshot.accounts.reduce(0) { total, account in
            total + (["credit", "loan"].contains(account.type) ? -abs(account.balance) : account.balance)
        }
    }

    private var monthlyExpenses: [LifeFinanceTransaction] {
        let calendar = Calendar.current
        return store.lifeSnapshot.transactions.filter {
            calendar.isDate($0.occurredAt, equalTo: .now, toGranularity: .month) && $0.amount < 0
        }
    }

    private var monthSpendCurrency: String? {
        let values = Set(monthlyExpenses.map(\.currency))
        return values.count == 1 ? values.first : nil
    }

    private var monthSpend: Double {
        abs(monthlyExpenses.reduce(0) { $0 + $1.amount })
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $lifeSection,
                    choices: LifeSection.allCases,
                    accessibilityIdentifier: "remember.section.life",
                    title: { $0.rawValue }
                )
                Group {
                    if store.lifeSnapshot.accounts.isEmpty {
                    ContentUnavailableView {
                        Label("No accounts yet", systemImage: "wallet.bifold")
                    } description: {
                        Text("Add an account to begin tracking balances and activity.")
                    }
                    } else {
                        ScrollView {
                        LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                            balanceSummary
                            moneyActions
                            accountsSection
                            if !store.lifeSnapshot.transactions.isEmpty {
                                activitySection
                            }
                        }
                        .padding(RememberDesign.spacing)
                        .padding(.bottom, RememberDesign.spacingXLarge)
                        }
                        .refreshable { await store.loadLife() }
                    }
                }
            }
            .navigationTitle("Money")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                QuickAddBar(
                    title: store.lifeSnapshot.accounts.isEmpty ? "Add an account" : "Add a transaction",
                    systemImage: "plus"
                ) {
                    if store.lifeSnapshot.accounts.isEmpty { accountComposerIsPresented = true }
                    else { transactionComposerIsPresented = true }
                }
            }
            .sheet(isPresented: $accountComposerIsPresented) { FinanceAccountComposerView() }
            .sheet(isPresented: $transactionComposerIsPresented) { FinanceTransactionComposerView() }
            .rememberPrimaryActions()
        }
    }

    private var moneyActions: some View {
        Button("Add another account", systemImage: "wallet.bifold") {
            accountComposerIsPresented = true
        }
        .font(.subheadline.weight(.semibold))
        .frame(minHeight: 44)
    }

    private var balanceSummary: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(netWorth == nil ? "Balances" : "Net worth")
                .font(.subheadline)
                .foregroundStyle(RememberDesign.secondaryText)
            if let netWorth, let accountCurrency {
                Text(netWorth, format: .currency(code: accountCurrency).precision(.fractionLength(0)))
                    .font(.largeTitle.bold().monospacedDigit())
                Text("Across \(store.lifeSnapshot.accounts.count) accounts")
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            } else {
                Text("Multiple currencies")
                    .font(.title2.bold())
                Text("Totals stay separate so Remember does not show a misleading conversion.")
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberSurface()
    }

    private var accountsSection: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text("Accounts")
                .font(.headline)
            VStack(spacing: 0) {
                ForEach(store.lifeSnapshot.accounts) { account in
                    let rowLayout = dynamicTypeSize.isAccessibilitySize
                        ? AnyLayout(VStackLayout(alignment: .leading, spacing: RememberDesign.spacingSmall))
                        : AnyLayout(HStackLayout(spacing: 12))
                    rowLayout {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "creditcard")
                                .foregroundStyle(RememberDesign.accent)
                                .frame(width: 28)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(account.name)
                                    .font(.subheadline.weight(.semibold))
                                Text(account.institution.isEmpty ? account.type.capitalized : account.institution)
                                    .font(.caption)
                                    .foregroundStyle(RememberDesign.secondaryText)
                            }
                        }
                        if !dynamicTypeSize.isAccessibilitySize {
                            Spacer()
                        }
                        Text(account.balance, format: .currency(code: account.currency))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                    }
                    .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
                    .padding(.vertical, dynamicTypeSize.isAccessibilitySize ? RememberDesign.spacingSmall : 0)
                    if account.id != store.lifeSnapshot.accounts.last?.id {
                        Divider().padding(.leading, 48)
                    }
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        }
    }

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            let headerLayout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
                : AnyLayout(HStackLayout(alignment: .firstTextBaseline))
            headerLayout {
                Text("Recent activity")
                    .font(.headline)
                if !dynamicTypeSize.isAccessibilitySize {
                    Spacer()
                }
                if let monthSpendCurrency {
                    Text("\(monthSpend, format: .currency(code: monthSpendCurrency).precision(.fractionLength(0))) this month")
                        .font(.caption)
                        .foregroundStyle(RememberDesign.secondaryText)
                } else if !monthlyExpenses.isEmpty {
                    Text("Multiple currencies this month")
                        .font(.caption)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
            }
            VStack(spacing: 0) {
                ForEach(store.lifeSnapshot.transactions.prefix(20)) { transaction in
                    let rowLayout = dynamicTypeSize.isAccessibilitySize
                        ? AnyLayout(VStackLayout(alignment: .leading, spacing: RememberDesign.spacingSmall))
                        : AnyLayout(HStackLayout())
                    rowLayout {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(transaction.merchant.isEmpty ? transaction.name : transaction.merchant)
                                .font(.subheadline.weight(.semibold))
                            Text("\(transaction.category) · \(transaction.occurredAt.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        if !dynamicTypeSize.isAccessibilitySize {
                            Spacer()
                        }
                        Text(transaction.amount, format: .currency(code: transaction.currency))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(transaction.amount > 0 ? RememberDesign.accent : .primary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                    .padding(.vertical, dynamicTypeSize.isAccessibilitySize ? RememberDesign.spacingSmall : 0)
                    if transaction.id != store.lifeSnapshot.transactions.prefix(20).last?.id {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        }
    }
}
