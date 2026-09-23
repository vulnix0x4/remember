import SwiftUI

struct TimelineView: View {
    let entries: [EvolutionTimelineEntry]

    var body: some View {
        if entries.isEmpty {
            RememberEmptyState(
                systemImage: "calendar",
                title: "No history yet",
                message: "It builds up as you save more."
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "How your interests changed")
                ForEach(entries) { entry in
                    HStack(alignment: .center, spacing: RememberDesign.spacing) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(monthLabel(entry.month))
                                .font(.rememberRowTitle)
                            Text(entry.theme)
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.text2)
                        }
                        Spacer()
                        Text("\(entry.count)")
                            .font(.title3.monospacedDigit().weight(.bold))
                            .foregroundStyle(RememberDesign.text2)
                            .accessibilityLabel(CountLabelFormatter.text(entry.count, singular: "save"))
                    }
                    .rememberCard(padding: RememberDesign.spacing)
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func monthLabel(_ value: String) -> String {
        guard let date = try? Date("\(value)-01T00:00:00Z", strategy: .iso8601) else { return value }
        return date.formatted(.dateTime.month(.wide).year())
    }
}
