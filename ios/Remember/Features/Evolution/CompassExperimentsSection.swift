import SwiftUI

struct CompassExperimentsSection: View {
    let experiments: [CompassExperiment]
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("TESTING IN REAL LIFE")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(RememberDesign.secondaryText)
                Text("Ideas you’re trying")
                    .font(.title2)
                    .bold()
            }

            if experiments.isEmpty {
                ContentUnavailableView(
                    "No experiments underway",
                    systemImage: "flask",
                    description: Text("Turn a saved idea into an experiment to find out whether it works for you.")
                )
            } else {
                ForEach(experiments) { experiment in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text(experiment.task.status == .active ? "CURRENT EXPERIMENT" : "READY WHEN YOU ARE")
                            .font(.caption)
                            .bold()
                            .foregroundStyle(RememberDesign.secondaryText)
                        Text(experiment.task.title)
                            .font(.headline)
                            .fixedSize(horizontal: false, vertical: true)
                        if let imprint = experiment.imprint {
                            NavigationLink(value: imprint) {
                                Label("From \(imprint.title)", systemImage: "bookmark")
                                    .lineLimit(2)
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(RememberDesign.accent)
                        }
                    }
                    .padding(.vertical, RememberDesign.spacingSmall)
                    Divider()
                }

                Button("Open these in Plan", systemImage: "arrow.right", action: openPlan)
                    .buttonStyle(.borderedProminent)
            }
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
