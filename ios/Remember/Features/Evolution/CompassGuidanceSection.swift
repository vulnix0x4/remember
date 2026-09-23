import SwiftUI

struct CompassGuidanceSection: View {
    let guidance: [CompassGuidance]
    @Environment(AppStore.self) private var store
    @State private var workingID: String?
    @State private var errorMessage: String?
    @State private var experimentToRetry: CompassExperiment?

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                Text("From real life")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(RememberDesign.accent)
                    .accessibilityIdentifier("remember.compass-guidance")
                Text("What your experiments are teaching you")
                    .font(.title2)
                    .bold()
                Text("Remember uses what happened, not just what you saved.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }

            ForEach(guidance) { item in
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Label(label(for: item.kind), systemImage: symbol(for: item.kind))
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(item.kind == .keep ? RememberDesign.accent : RememberDesign.secondaryText)
                        .accessibilityIdentifier("remember.compass-guidance.\(item.kind)")
                    Text(item.experiment.task.title)
                        .font(.headline)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(detail(for: item.kind))
                        .font(.body)
                        .foregroundStyle(RememberDesign.secondaryText)
                    if let reflection = item.experiment.task.practiceReflection, !reflection.isEmpty {
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
                    actionRow(for: item)
                }
                .padding(.vertical, RememberDesign.spacingSmall)
                Divider()
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .padding(RememberDesign.spacing)
        .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .sheet(item: $experimentToRetry) { experiment in
            RetryPracticeView(experiment: experiment)
        }
    }

    @ViewBuilder
    private func actionRow(for item: CompassGuidance) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            switch item.kind {
            case .keep:
                if let principle = item.principle {
                    if principle.status == "active" {
                        Label("Already in your compass", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                    } else {
                        Button("Keep as a principle", systemImage: "checkmark") {
                            update(principle, status: "active")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .foregroundStyle(RememberDesign.accentInk)
                    }
                }
            case .adjust:
                Button("Adjust and try again", systemImage: "arrow.clockwise") {
                    experimentToRetry = item.experiment
                }
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
            case .release:
                if let principle = item.principle {
                    if principle.status == "dismissed" {
                        Label("Already released", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                    } else {
                        Button("Release this idea", systemImage: "minus") {
                            update(principle, status: "dismissed")
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            if let imprint = item.experiment.imprint {
                NavigationLink(value: imprint) {
                    Label("See what this came from", systemImage: "bookmark")
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
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
                errorMessage = "That choice could not be saved. Try again."
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
        case .keep: "This helped. Keep it available as a principle, not just a saved thought."
        case .adjust: "Part of this worked. Change one part before you decide whether it belongs."
        case .release: "This did not fit you. You can stop carrying it."
        }
    }
}
