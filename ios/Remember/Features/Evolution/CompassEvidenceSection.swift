import SwiftUI

struct CompassEvidenceSection: View {
    let completedExperiments: [CompassExperiment]
    let changes: [CompassReflection]
    @State private var experimentToReflectOn: LifeTask?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("WHAT CHANGED")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(RememberDesign.secondaryText)
                Text("What experience taught you")
                    .font(.title2)
                    .bold()
            }

            ForEach(completedExperiments) { experiment in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Label(experiment.task.title, systemImage: "checkmark.circle.fill")
                        .font(.headline)
                        .foregroundStyle(RememberDesign.accent)
                    if let outcome = experiment.task.practiceOutcome {
                        Text(resultMeaning(outcome))
                            .foregroundStyle(RememberDesign.secondaryText)
                        if let reflection = experiment.task.practiceReflection, !reflection.isEmpty {
                            Text(reflection)
                                .font(.body)
                                .italic()
                                .padding(.leading, RememberDesign.spacingSmall)
                                .overlay(alignment: .leading) {
                                    Rectangle()
                                        .fill(RememberDesign.accent)
                                        .frame(width: 2)
                                }
                        }
                    } else {
                        Text("You tried this and completed it. What did real life teach you?")
                            .foregroundStyle(RememberDesign.secondaryText)
                        Button("Add what happened", systemImage: "quote.bubble") {
                            experimentToReflectOn = experiment.task
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .foregroundStyle(RememberDesign.accentInk)
                    }
                    if let imprint = experiment.imprint {
                        NavigationLink(value: imprint) {
                            Label("See the idea it came from", systemImage: "bookmark")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, RememberDesign.spacingSmall)
                Divider()
            }

            ForEach(changes) { change in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Label(change.imprint?.title ?? "A saved idea", systemImage: "arrow.trianglehead.2.clockwise.rotate.90")
                        .font(.headline)
                    Text(change.statement)
                        .foregroundStyle(RememberDesign.secondaryText)
                    if let imprint = change.imprint {
                        NavigationLink(value: imprint) {
                            Label("Revisit the evidence", systemImage: "bookmark")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, RememberDesign.spacingSmall)
                Divider()
            }
        }
        .sheet(item: $experimentToReflectOn) { task in
            PracticeResultView(task: task, minutesSpent: 0, completesTask: false, onSaved: {})
        }
    }

    private func resultMeaning(_ outcome: PracticeOutcome) -> String {
        switch outcome {
        case .helped: "It helped. This earned a place in your real life."
        case .mixed: "Somewhat. Some of it worked, and some still needs testing."
        case .notForMe: "Not for me. Trying it gave you permission to let it go."
        }
    }
}
