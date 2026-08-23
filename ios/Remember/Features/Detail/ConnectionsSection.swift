import SwiftUI

struct ConnectionsSection: View {
    let connections: [Connection]
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Across your memory", title: "Connections")
            if connections.isEmpty {
                Text("Connections will appear as your library grows.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            ForEach(connections) { connection in
                if let related = store.imprint(withID: connection.itemID) {
                    NavigationLink(value: related) {
                        ConnectionRow(connection: connection)
                    }
                    .buttonStyle(.plain)
                } else {
                    ConnectionRow(connection: connection)
                }
            }
        }
    }
}
