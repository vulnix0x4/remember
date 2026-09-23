import SwiftUI

struct ThemesView: View {
    let themes: [EvolutionTheme]

    var body: some View {
        if themes.isEmpty {
            ContentUnavailableView(
                "No recurring topics yet",
                systemImage: "tag",
                description: Text("Topics appear after they show up in more than one save.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text("Topics you return to")
                    .font(.title2)
                    .bold()
                ForEach(themes) { theme in
                    HStack {
                        Text(theme.name)
                            .font(.body)
                            .fontWeight(.semibold)
                        Spacer()
                        Text(CountLabelFormatter.text(theme.count, singular: "source"))
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                    .rememberSurface()
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}
