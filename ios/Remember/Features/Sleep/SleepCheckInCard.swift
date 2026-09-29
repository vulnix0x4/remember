import SwiftUI

/// "How did you sleep?" after I'm up. Apple Health answers the rest when it can.
struct SleepCheckInCard: View {
    @Environment(AppStore.self) private var store
    let night: SleepSession

    @State private var rating: SleepRating?
    @State private var feedback = 0

    private var health: LifeHealthMetric? { SleepInsights.healthNight(for: night, metrics: store.lifeSnapshot.health) }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            Text(rating == nil ? "How did you sleep?" : "How long until you fell asleep?")
                .font(.rememberSectionTitle)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .transition(.opacity)
            if rating == nil {
                // Side by side, stacked when the text is large.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: RememberDesign.spacingSmall) { ratingButtons }
                    VStack(spacing: RememberDesign.spacingSmall) { ratingButtons }
                }
            } else {
                FlowLayout(spacing: RememberDesign.spacingSmall) {
                    ForEach(SleepLatency.allCases, id: \.self) { choice in
                        Button(choice.label) { answer(choice) }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(RememberDesign.text)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 44)
                            .background(RememberDesign.cardRaised, in: .capsule)
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("remember.sleep.checkin.latency.\(choice.rawValue)")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard(padding: RememberDesign.spacing)
        .sensoryFeedback(.selection, trigger: feedback)
        .animation(.snappy, value: rating)
    }

    private var ratingButtons: some View {
        ForEach(SleepRating.allCases, id: \.self) { choice in
            Button(choice.label) { rate(choice) }
                .buttonStyle(.rememberSecondary)
                .accessibilityIdentifier("remember.sleep.checkin.\(choice.rawValue)")
        }
    }

    private func rate(_ choice: SleepRating) {
        feedback += 1
        if let health {
            save(SleepInsights.savedNight(night, rating: choice), hours: health.value)
        } else {
            rating = choice
        }
    }

    private func answer(_ latency: SleepLatency) {
        feedback += 1
        guard let rating, let metric = SleepInsights.savedNight(night, rating: rating, latency: latency) else { return }
        save(metric, hours: metric.value)
    }

    private func save(_ metric: HealthMetricUpload?, hours: Double) {
        guard let metric else { return }
        Task { await store.saveSleepNight(metric, toast: "Saved · \(hours.sleepDurationLabel)") }
    }
}
