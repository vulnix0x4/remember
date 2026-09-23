import SwiftUI

struct CompassGuidanceSection: View {
    let guidance: [CompassGuidance]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?
    @State private var experimentToRetry: CompassExperiment?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "From real life")
                .accessibilityIdentifier("remember.compass-guidance")

            ForEach(guidance) { item in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Label(label(for: item.kind), systemImage: symbol(for: item.kind))
                        .font(.rememberMeta)
                        .foregroundStyle(item.kind == .keep ? RememberDesign.accent : RememberDesign.text2)
                        .accessibilityIdentifier("remember.compass-guidance.\(item.kind)")
                    Text(item.experiment.task.title)
                        .font(.rememberRowTitle)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(detail(for: item.kind))
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                    if let reflection = item.experiment.task.practiceReflection, !reflection.isEmpty {
                        PatternQuote(text: reflection)
                    }
                    actionRow(for: item)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .sheet(item: $experimentToRetry) { experiment in
            RetryPracticeView(experiment: experiment)
        }
    }

    @ViewBuilder
    private func actionRow(for item: CompassGuidance) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            switch item.kind {
            case .keep:
                if let principle = item.principle {
                    if principle.status == "active" {
                        Label("In your compass", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                            .frame(minHeight: 44)
                    } else {
                        Button("Keep as a principle", systemImage: "checkmark") {
                            update(principle, status: "active")
                        }
                        .buttonStyle(.rememberSecondary)
                    }
                }
            case .adjust:
                Button("Adjust and try again", systemImage: "arrow.clockwise") {
                    experimentToRetry = item.experiment
                }
                .buttonStyle(.rememberSecondary)
            case .release:
                if let principle = item.principle {
                    if principle.status == "dismissed" {
                        Label("Released", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                            .frame(minHeight: 44)
                    } else {
                        Button("Release this idea", systemImage: "minus") {
                            update(principle, status: "dismissed")
                        }
                        .buttonStyle(.rememberSecondary)
                    }
                }
            }

            if let imprint = item.experiment.imprint {
                NavigationLink(value: imprint) {
                    Label("See where it came from", systemImage: "bookmark")
                }
                .buttonStyle(.rememberQuiet)
            }
        }
        .disabled(workingID != nil)
    }

    private func update(_ principle: EvolutionPrinciple, status: String) {
        guard workingID == nil else { return }
        workingID = principle.id
        errorMessage = nil
        Task {
            do {
                try await store.setPrincipleStatus(principle, status: status)
            } catch {
                errorMessage = "Couldn’t save that. Try again."
            }
            workingID = nil
        }
    }

    private func label(for kind: CompassGuidanceKind) -> String {
        switch kind {
        case .keep: "Keep"
        case .adjust: "Adjust"
        case .release: "Release"
        }
    }

    private func symbol(for kind: CompassGuidanceKind) -> String {
        switch kind {
        case .keep: "checkmark.circle"
        case .adjust: "arrow.clockwise"
        case .release: "minus.circle"
        }
    }

    private func detail(for kind: CompassGuidanceKind) -> String {
        switch kind {
        case .keep: "This helped. Keep it as a principle."
        case .adjust: "Part of it worked. Change one thing."
        case .release: "Didn’t fit. You can let it go."
        }
    }
}
