import SwiftUI

struct CurrencySelectionRow: View {
    @Binding var currency: String
    let additionalCodes: [String]
    let isDisabled: Bool
    @State private var sheetIsPresented = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(currency: Binding<String>, additionalCodes: [String] = [], isDisabled: Bool = false) {
        _currency = currency
        self.additionalCodes = additionalCodes
        self.isDisabled = isDisabled
    }

    var body: some View {
        Button {
            sheetIsPresented = true
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
        .sheet(isPresented: $sheetIsPresented) {
            SearchableChoiceSheet(
                title: "Currency",
                choices: currencyChoices,
                selection: $currency,
                label: { $0 },
                detail: { Locale.current.localizedString(forCurrencyCode: $0) }
            )
        }
    }

    private var currencyName: String? {
        Locale.current.localizedString(forCurrencyCode: currency)
    }

    private var currencyChoices: [String] {
        Array(Set(Locale.commonISOCurrencyCodes + additionalCodes + [currency])).sorted()
    }
}
