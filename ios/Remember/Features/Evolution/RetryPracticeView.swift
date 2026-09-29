import SwiftUI

struct RetryPracticeView: View {
    let experiment: CompassExperiment
    let onSaved: (() -> Void)?
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: Field?
    @State private var title: String
    @State private var firstStep: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private enum Field { case title, firstStep }

    init(experiment: CompassExperiment, onSaved: (() -> Void)? = nil) {
        self.experiment = experiment
        self.onSaved = onSaved
        _title = State(initialValue: experiment.task.title)
        _firstStep = State(initialValue: experiment.task.firstStep)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text("Try a new version")
                            .font(.rememberHero)
                            .accessibilityAddTraits(.isHeader)
                        Text("Keep what worked. Change one thing.")
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                    }

                    field("What will you try?", text: $title, field: .title)
                    field("First step", text: $firstStep, field: .firstStep)

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle")
                            .font(.rememberMeta)
                            .foregroundStyle(RememberDesign.danger)
                    }
                }
                .padding(RememberDesign.spacing)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(RememberDesign.canvas)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Button(isSaving ? "Adding…" : "Add to Plan", action: save)
                    .buttonStyle(.rememberPrimary)
                    .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || firstStep.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.vertical, RememberDesign.spacingSmall)
                    .background(RememberDesign.canvas)
                    .accessibilityIdentifier("remember.retry-practice.save")
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private func field(_ label: String, text: Binding<String>, field: Field) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: label)
            TextField(label, text: text, axis: .vertical)
                .lineLimit(2...5)
                .focused($focusedField, equals: field)
                .padding(RememberDesign.spacing)
                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
        }
    }

    private func save() {
        guard !isSaving else { return }
        isSaving = true
        errorMessage = nil
        let task = experiment.task
        Task {
            let succeeded = await store.createLifeTask(
                title: title,
                firstStep: firstStep,
                notes: task.notes,
                area: task.area,
                duration: task.durationMinutes,
                priority: task.priority,
                source: "practice",
                sourceItemId: task.sourceItemId
            )
            if succeeded {
                onSaved?()
                dismiss()
            } else {
                errorMessage = "Couldn’t add that. Try again."
                isSaving = false
            }
        }
    }
}
