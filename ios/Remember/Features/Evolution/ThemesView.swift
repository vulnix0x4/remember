import SwiftUI

struct ThemesView: View {
    let themes: [EvolutionTheme]

    var body: some View {
        if themes.isEmpty {
            ContentUnavailableView(
                "No themes yet",
                systemImage: "tag",
                description: Text("Themes appear here only when they exist in an analyzed source.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                SectionHeader(eyebrow: "From your analyses", title: "Themes")
                ForEach(themes) { theme in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    HStack {
                        Text(theme.name).font(.title3).bold()
                        Spacer()
                        Text(CountLabelFormatter.text(theme.count, singular: "source"))
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                    Label("Present in your analyzed library", systemImage: "checkmark.seal")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.accent)
                }
                .padding(RememberDesign.spacing)
                .background(.background, in: .rect(cornerRadius: 14))
                }
            }
        }
    }
}
