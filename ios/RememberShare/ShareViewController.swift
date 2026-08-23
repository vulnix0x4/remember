import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        loadSharedURL()
    }

    private func loadSharedURL() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) else {
            finish(error: ShareError.missingURL)
            return
        }

        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
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
        if let string = item as? String { return URL(string: string) }
        return nil
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
