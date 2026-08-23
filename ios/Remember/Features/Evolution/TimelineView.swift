import SwiftUI

struct TimelineView: View {
    let entries: [EvolutionTimelineEntry]

    var body: some View {
        if entries.isEmpty {
            ContentUnavailableView(
                "No timeline yet",
                systemImage: "calendar",
                description: Text("The timeline is built from the actual save dates and themes of analyzed sources.")
            )
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(entries) { entry in
                HStack(alignment: .top, spacing: RememberDesign.spacing) {
                    VStack(spacing: 0) {
                        Circle().fill(RememberDesign.accent).frame(width: 12, height: 12)
                        Rectangle().fill(.tertiary).frame(width: 1).frame(minHeight: 88)
                    }
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(monthLabel(entry.month)).font(.title2).bold()
                        Text(entry.theme)
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.accent)
                        Text("\(CountLabelFormatter.text(entry.count, singular: "analyzed source")) saved in this month")
                            .font(.body)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                    .padding(.bottom, RememberDesign.spacingLarge)
                }
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
