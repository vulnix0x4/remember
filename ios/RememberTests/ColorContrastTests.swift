import Foundation
import Testing

struct ColorContrastTests {
    @Test func productionDarkThemeTextTokensMeetWCAGAA() {
        let canvas = luminance(red: 0.027, green: 0.047, blue: 0.035)
        let secondaryText = luminance(red: 0.62, green: 0.68, blue: 0.64)
        let accent = luminance(red: 0.64, green: 0.82, blue: 0.70)
        let accentInk = luminance(red: 0.035, green: 0.10, blue: 0.064)

        #expect(contrast(canvas, secondaryText) >= 4.5)
        #expect(contrast(canvas, accent) >= 4.5)
        #expect(contrast(accent, accentInk) >= 4.5)
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
