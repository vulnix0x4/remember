import SwiftUI

struct PersonalCompassView: View {
    let compass: PersonalCompass

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingXLarge) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Label("Your compass", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(RememberDesign.accent)
                    .accessibilityIdentifier("remember.personal-compass")
                Text("What you’re carrying now")
                    .font(.title)
                    .bold()
                Text("Built from choices you made and real-life tests, never a profile Remember assigned to you.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            if !compass.guidance.isEmpty {
                CompassGuidanceSection(guidance: compass.guidance)
            }

            CompassTruthsSection(principles: compass.truths)
            CompassExperimentsSection(experiments: compass.activeExperiments)

            if compass.completedExperiments.contains(where: { $0.task.practiceOutcome == nil }) || !compass.changes.isEmpty {
                CompassEvidenceSection(
                    completedExperiments: compass.completedExperiments.filter { $0.task.practiceOutcome == nil },
                    changes: compass.changes
                )
            }

            if !compass.suggestions.isEmpty {
                CompassSuggestionsSection(principles: compass.suggestions)
            }

            if let tension = compass.tension {
                CompassTensionSection(tension: tension)
            }
        }
    }
}
