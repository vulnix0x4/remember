import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        loadSharedURL()
    }

    private func loadSharedURL() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []
        let supportedTypes: [UTType] = [.url, .plainText, .text]
        let sharedInput = supportedTypes.lazy.compactMap { type in
            providers.first(where: { $0.hasItemConformingToTypeIdentifier(type.identifier) })
                .map { (provider: $0, typeIdentifier: type.identifier) }
        }.first

        guard let sharedInput else {
            finish(error: ShareError.missingURL)
            return
        }

        sharedInput.provider.loadItem(forTypeIdentifier: sharedInput.typeIdentifier, options: nil) { [weak self] item, error in
            let result: Result<URL, ShareError>
            if error == nil, let url = Self.url(from: item), Self.isSafeWebURL(url) {
                result = .success(url)
            } else {
                result = .failure(.invalidURL)
            }
            Task { @MainActor [weak self, result] in
                switch result {
                case .success(let url):
                    SharedCapture.enqueue(url)
                    self?.finish(error: nil)
                case .failure(let error):
                    self?.finish(error: error)
                }
            }
        }
    }

    nonisolated private static func url(from item: NSSecureCoding?) -> URL? {
        if let url = item as? URL { return url }
        guard let string = item as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if let directURL = URL(string: trimmed), isSafeWebURL(directURL) { return directURL }
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let range = NSRange(trimmed.startIndex..<trimmed.endIndex, in: trimmed)
        return detector.firstMatch(in: trimmed, options: [], range: range)?.url
    }

    nonisolated private static func isSafeWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "https" || scheme == "http"
    }

    private func finish(error: Error?) {
        if let error {
            extensionContext?.cancelRequest(withError: error)
        } else {
            extensionContext?.completeRequest(returningItems: nil)
        }
    }
}
