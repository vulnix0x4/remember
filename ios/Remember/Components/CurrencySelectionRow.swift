import SwiftUI

struct CurrencySelectionRow: View {
    @Binding var currency: String
    let additionalCodes: [String]
    let isDisabled: Bool
    /// Rows inside a Form/List can't present sheets reliably, so the host presents `CurrencyChoiceSheet`.
    let onSelect: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(currency: Binding<String>, additionalCodes: [String] = [], isDisabled: Bool = false, onSelect: @escaping () -> Void) {
        _currency = currency
        self.additionalCodes = additionalCodes
        self.isDisabled = isDisabled
        self.onSelect = onSelect
    }

    var body: some View {
        Button {
            onSelect()
        } label: {
            LabeledContent("Currency") {
                HStack(spacing: RememberDesign.spacingSmall) {
                    VStack(alignment: .trailing, spacing: RememberDesign.spacingXXSmall) {
                        Text(currency)
                            .foregroundStyle(.primary)
                        if let currencyName {
                            Text(currencyName)
                                .font(.caption)
                                .foregroundStyle(RememberDesign.secondaryText)
                                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
                        }
                    }
                    Image(systemName: "chevron.right")
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.tertiaryText)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityIdentifier("remember.currency.selection")
        .accessibilityValue([currency, currencyName].compactMap { $0 }.joined(separator: ", "))
        .accessibilityHint(isDisabled ? "Currency follows the selected account" : "Opens a searchable currency list")
    }

    private var currencyName: String? {
        Locale.current.localizedString(forCurrencyCode: currency)
    }

}

/// Searchable currency list. Present it from outside any Form/List row.
struct CurrencyChoiceSheet: View {
    @Binding var currency: String
    var additionalCodes: [String] = []

    var body: some View {
        SearchableChoiceSheet(
            title: "Currency",
            choices: Array(Set(Locale.commonISOCurrencyCodes + additionalCodes + [currency])).sorted(),
            selection: $currency,
            label: { $0 },
            detail: { Locale.current.localizedString(forCurrencyCode: $0) }
        )
    }
}
