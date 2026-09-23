import SwiftUI

struct TabBarIdentifierBridge: UIViewRepresentable {
    let identifiers: [String]

    func makeUIView(context: Context) -> TabBarIdentifierProbe {
        TabBarIdentifierProbe(identifiers: identifiers)
    }

    func updateUIView(_ view: TabBarIdentifierProbe, context: Context) {
        view.identifiers = identifiers
        view.applyIdentifiers()
    }
}
