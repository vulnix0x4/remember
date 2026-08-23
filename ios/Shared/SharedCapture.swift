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

    static func drain(defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) -> [URL] {
        guard let defaults else { return [] }
        let values = defaults.stringArray(forKey: pendingURLsKey) ?? []
        defaults.removeObject(forKey: pendingURLsKey)
        return values.compactMap(URL.init(string:))
    }
}
