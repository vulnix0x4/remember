import SwiftUI

struct PersonalCompassView: View {
    let compass: PersonalCompass

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            Text("What you’re carrying now")
                .font(.rememberSectionTitle)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("remember.personal-compass")

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

/// A reflection in the person's own words, set off by a hairline.
struct PatternQuote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.body.italic())
            .fixedSize(horizontal: false, vertical: true)
            .padding(.leading, RememberDesign.spacingCompact)
            .overlay(alignment: .leading) {
                Rectangle().fill(RememberDesign.line).frame(width: 2).accessibilityHidden(true)
            }
    }
}
