import SwiftUI

struct CompassExperimentsSection: View {
    let experiments: [CompassExperiment]
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Trying now")

            if experiments.isEmpty {
                Text("Nothing yet. Tap “Try this” on a save.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
            } else {
                ForEach(experiments) { experiment in
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text(experiment.task.status == .active ? "Doing now" : "Ready when you are")
                            .font(.rememberMeta)
                            .foregroundStyle(experiment.task.status == .active ? RememberDesign.accent : RememberDesign.text2)
                        Text(experiment.task.title)
                            .font(.rememberRowTitle)
                            .fixedSize(horizontal: false, vertical: true)
                        if let imprint = experiment.imprint {
                            NavigationLink(value: imprint) {
                                Label("From \(imprint.title)", systemImage: "bookmark")
                                    .lineLimit(1)
                            }
                            .buttonStyle(.rememberQuiet)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .rememberCard(padding: RememberDesign.spacing)
                }

                Button("Open in Plan", systemImage: "arrow.right", action: openPlan)
                    .buttonStyle(.rememberSecondary)
            }
        }
    }

    private func openPlan() {
        store.selectedTab = .tasks
    }
}
