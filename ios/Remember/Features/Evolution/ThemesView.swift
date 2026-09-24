import SwiftUI

struct ThemesView: View {
    let themes: [EvolutionTheme]

    var body: some View {
        if themes.isEmpty {
            RememberEmptyState(
                systemImage: "tag",
                title: "No topics yet",
                message: "They show up after a few saves."
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Topics you return to")
                ForEach(themes) { theme in
                    HStack {
                        Text(theme.name)
                            .font(.rememberRowTitle)
                        Spacer()
                        Text(CountLabelFormatter.text(theme.count, singular: "source"))
                            .font(.rememberMeta)
                            .foregroundStyle(RememberDesign.text2)
                    }
                    .frame(minHeight: RememberDesign.rowHeight - 32)
                    .rememberCard(padding: RememberDesign.spacing)
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}
