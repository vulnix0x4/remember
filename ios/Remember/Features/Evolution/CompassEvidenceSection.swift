import SwiftUI

struct CompassEvidenceSection: View {
    let completedExperiments: [CompassExperiment]
    let changes: [CompassReflection]
    @State private var experimentToReflectOn: LifeTask?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "What changed")

            ForEach(completedExperiments) { experiment in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Label(experiment.task.title, systemImage: "checkmark.circle.fill")
                        .font(.rememberRowTitle)
                        .labelStyle(AccentIconLabelStyle())
                    if let outcome = experiment.task.practiceOutcome {
                        Text(resultMeaning(outcome))
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                        if let reflection = experiment.task.practiceReflection, !reflection.isEmpty {
                            PatternQuote(text: reflection)
                        }
                    } else {
                        Text("How did it go?")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                        Button("Add what happened", systemImage: "quote.bubble") {
                            experimentToReflectOn = experiment.task
                        }
                        .buttonStyle(.rememberSecondary)
                    }
                    if let imprint = experiment.imprint {
                        NavigationLink(value: imprint) {
                            Label("See the idea it came from", systemImage: "bookmark")
                        }
                        .buttonStyle(.rememberQuiet)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)
            }

            ForEach(changes) { change in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text(change.imprint?.title ?? "A saved idea")
                        .font(.rememberRowTitle)
                    Text(change.statement)
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                    if let imprint = change.imprint {
                        NavigationLink(value: imprint) {
                            Label("Revisit the evidence", systemImage: "bookmark")
                        }
                        .buttonStyle(.rememberQuiet)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)
            }
        }
        .sheet(item: $experimentToReflectOn) { task in
            PracticeResultView(task: task, minutesSpent: 0, completesTask: false, onSaved: {})
        }
    }

    private func resultMeaning(_ outcome: PracticeOutcome) -> String {
        switch outcome {
        case .helped: "It helped."
        case .mixed: "Some of it worked."
        case .notForMe: "Not for you. Fine to let go."
        }
    }
}

/// Label whose icon is the accent (for checkmarks and progress only).
struct AccentIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: RememberDesign.spacingSmall) {
            configuration.icon.foregroundStyle(RememberDesign.accent)
            configuration.title
        }
    }
}
