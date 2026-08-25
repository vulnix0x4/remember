import Foundation

enum URLValidator {
    static func validatedWebURL(from input: String) -> URL? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed),
              url.scheme?.lowercased() == "https",
              url.host() != nil else { return nil }
        return url
    }
}
