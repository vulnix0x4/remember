import UIKit

@MainActor
final class TabBarIdentifierProbe: UIView {
    var identifiers: [String]

    init(identifiers: [String]) {
        self.identifiers = identifiers
        super.init(frame: .zero)
        isAccessibilityElement = false
        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is unavailable")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        applyIdentifiers()
        Task { @MainActor [weak self] in
            await Task.yield()
            self?.applyIdentifiers()
        }
    }

    func applyIdentifiers() {
        guard let tabBarController = findTabBarController(from: window?.rootViewController) else { return }
        for (item, identifier) in zip(tabBarController.tabBar.items ?? [], identifiers) {
            item.accessibilityIdentifier = identifier
        }
    }

    private func findTabBarController(from controller: UIViewController?) -> UITabBarController? {
        guard let controller else { return nil }
        if let tabBarController = controller as? UITabBarController {
            return tabBarController
        }
        for child in controller.children {
            if let match = findTabBarController(from: child) {
                return match
            }
        }
        if let presented = controller.presentedViewController {
            return findTabBarController(from: presented)
        }
        return nil
    }
}
