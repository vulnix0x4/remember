import SwiftUI

struct TimelineView: View {
    let entries: [EvolutionTimelineEntry]

    var body: some View {
        if entries.isEmpty {
            ContentUnavailableView(
                "No history yet",
                systemImage: "calendar",
                description: Text("History is built from dates and topics across your saves.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("How your interests changed")
                    .font(.title2)
                    .bold()
                ForEach(entries) { entry in
                    HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacing) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                            Text(monthLabel(entry.month))
                                .font(.headline)
                            Text(entry.theme)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        Spacer()
                        Text("\(entry.count)")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundStyle(RememberDesign.accent)
                            .accessibilityLabel(CountLabelFormatter.text(entry.count, singular: "save"))
                    }
                    .rememberSurface()
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
