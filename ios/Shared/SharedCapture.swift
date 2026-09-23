import Foundation

enum SharedCapture {
    static var appGroup: String {
        Bundle.main.object(forInfoDictionaryKey: "RememberAppGroup") as? String
            ?? "group.com.example.remember.shared"
    }
    static let pendingURLsKey = "pendingURLs"

    static func enqueue(_ url: URL, defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) {
        guard let defaults else { return }
        var values = defaults.stringArray(forKey: pendingURLsKey) ?? []
        guard !values.contains(url.absoluteString) else { return }
        values.append(url.absoluteString)
        defaults.set(values, forKey: pendingURLsKey)
    }

    static func pendingURLs(defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) -> [URL] {
        guard let defaults else { return [] }
        let values = defaults.stringArray(forKey: pendingURLsKey) ?? []
        return values.compactMap(URL.init(string:))
    }

    static func acknowledge(_ url: URL, defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) {
        guard let defaults else { return }
        let values = defaults.stringArray(forKey: pendingURLsKey) ?? []
        let remaining = values.filter { $0 != url.absoluteString }
        if remaining.isEmpty {
            defaults.removeObject(forKey: pendingURLsKey)
        } else {
            defaults.set(remaining, forKey: pendingURLsKey)
        }
    }
}
