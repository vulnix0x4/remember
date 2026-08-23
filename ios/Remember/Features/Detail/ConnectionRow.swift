import SwiftUI

struct ConnectionRow: View {
    let connection: Connection

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Label(connection.type.label, systemImage: connection.type == .contradicts ? "arrow.left.arrow.right" : "link")
                .font(.subheadline)
                .bold()
                .foregroundStyle(RememberDesign.accent)
            Text(connection.title).font(.headline)
            Text(connection.explanation).font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
        }
        .padding(RememberDesign.spacing)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.1), in: .rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the connected imprint")
    }
}
