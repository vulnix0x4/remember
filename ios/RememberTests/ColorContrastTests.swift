import Foundation
import Testing

struct ColorContrastTests {
    @Test func semanticTextTokensMeetWCAGAAInBothAppearances() {
        let lightBackground = luminance(red: 0.98, green: 0.96, blue: 0.92)
        let darkBackground = luminance(red: 0.075, green: 0.07, blue: 0.065)
        let lightSecondary = luminance(red: 0.373, green: 0.357, blue: 0.341)
        let darkSecondary = luminance(red: 0.780, green: 0.769, blue: 0.761)
        let lightAccent = luminance(red: 0.478, green: 0.247, blue: 0.196)
        let darkAccent = luminance(red: 0.871, green: 0.651, blue: 0.604)

        #expect(contrast(lightBackground, lightSecondary) >= 4.5)
        #expect(contrast(darkBackground, darkSecondary) >= 4.5)
        #expect(contrast(lightBackground, lightAccent) >= 4.5)
        #expect(contrast(darkBackground, darkAccent) >= 4.5)
    }

    private func luminance(red: Double, green: Double, blue: Double) -> Double {
        func channel(_ value: Double) -> Double {
            value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    }

    private func contrast(_ first: Double, _ second: Double) -> Double {
        (max(first, second) + 0.05) / (min(first, second) + 0.05)
    }
}
