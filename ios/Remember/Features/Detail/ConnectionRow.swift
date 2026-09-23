import SwiftUI

struct ConnectionRow: View {
    let connection: Connection
    var opensConnectedSave = false

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Label(connection.type.label, systemImage: connection.type == .contradicts ? "arrow.left.arrow.right" : "link")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text3)
            Text(connection.title).font(.rememberRowTitle).foregroundStyle(RememberDesign.text)
            Text(connection.explanation).font(.subheadline).foregroundStyle(RememberDesign.text2)
        }
        .padding(RememberDesign.spacing)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .accessibilityElement(children: .combine)
        .accessibilityHint(opensConnectedSave ? "Opens the connected save" : "")
    }
}
