import SwiftUI

struct ConnectionsSection: View {
    let connections: [Connection]
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Related saves")
            if connections.isEmpty {
                Text("Related saves will appear as your library grows.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
            }
            ForEach(connections) { connection in
                if let related = store.imprint(withID: connection.itemID) {
                    NavigationLink(value: related) {
                        ConnectionRow(connection: connection, opensConnectedSave: true)
                    }
                    .buttonStyle(.plain)
                } else {
                    ConnectionRow(connection: connection)
                }
            }
        }
    }
}
