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
                    Text("Keep the part that worked and change the part that did not.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.secondaryText)

                    field("What will you try this time?", text: $title, field: .title)
                    field("What is the first step?", text: $firstStep, field: .firstStep)

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(RememberDesign.danger)
                    }
                }
                .padding(RememberDesign.spacing)
                .padding(.bottom, 92)
            }
            .safeAreaInset(edge: .bottom) {
                Button(isSaving ? "Adding…" : "Add to Plan", action: save)
                    .buttonStyle(.borderedProminent)
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.accentInk)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || firstStep.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.vertical, RememberDesign.spacingSmall)
                    .background(.bar)
                    .accessibilityIdentifier("remember.retry-practice.save")
            }
            .navigationTitle("Try a new version")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
                }
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, field: Field) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Text(label)
                .font(.headline)
            TextField(label, text: text, axis: .vertical)
                .lineLimit(2...5)
                .textFieldStyle(.roundedBorder)
                .focused($focusedField, equals: field)
                .frame(minHeight: 48)
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
                errorMessage = "That new experiment could not be added. Try again."
                isSaving = false
            }
        }
    }
}
