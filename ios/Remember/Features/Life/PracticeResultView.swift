import SwiftUI

struct PracticeResultView: View {
    let task: LifeTask
    let minutesSpent: Int
    let completesTask: Bool
    let onSaved: () -> Void

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var outcome: PracticeOutcome?
    @State private var reflection = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text("REAL-LIFE RESULT")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(RememberDesign.accent)
                        Text("What happened when you tried it?")
                            .font(.largeTitle.bold())
                        Text("You tested “\(task.title).” This answer becomes evidence in your Personal Compass.")
                            .foregroundStyle(RememberDesign.secondaryText)
                    }

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text("Did this help?")
                            .font(.headline)
                        ForEach(PracticeOutcome.allCases, id: \.self) { choice in
                            Button {
                                outcome = choice
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: outcome == choice ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(outcome == choice ? RememberDesign.accent : RememberDesign.tertiaryText)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(choice.label)
                                            .font(.headline)
                                        Text(choice.meaning)
                                            .font(.subheadline)
                                            .foregroundStyle(RememberDesign.secondaryText)
                                    }
                                    Spacer()
                                }
                                .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                                .padding(.horizontal, RememberDesign.spacing)
                                .background(outcome == choice ? RememberDesign.accent.opacity(0.1) : RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
                                .overlay {
                                    RoundedRectangle(cornerRadius: RememberDesign.controlRadius)
                                        .stroke(outcome == choice ? RememberDesign.accent : RememberDesign.line)
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("remember.practice-result.\(choice.rawValue)")
                            .accessibilityAddTraits(outcome == choice ? .isSelected : [])
                        }
                    }

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text("What did you notice?  Optional")
                            .font(.headline)
                        TextEditor(text: $reflection)
                            .frame(minHeight: 120)
                            .padding(RememberDesign.spacingSmall)
                            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
                            .overlay {
                                RoundedRectangle(cornerRadius: RememberDesign.controlRadius)
                                    .stroke(RememberDesign.line)
                            }
                            .accessibilityLabel("What did you notice?")
                            .accessibilityIdentifier("remember.practice-result.note")
                    }

                    Button(completesTask ? "Finish and remember this" : "Remember this result", systemImage: "checkmark") {
                        save()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.accentInk)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .disabled(outcome == nil || isSaving)
                    .accessibilityIdentifier("remember.practice-result.save")
                }
                .padding(RememberDesign.spacing)
                .padding(.bottom, RememberDesign.spacingLarge)
            }
            .navigationTitle("Experiment result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                        .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.large])
        .interactiveDismissDisabled(isSaving)
    }

    private func save() {
        guard let outcome, !isSaving else { return }
        isSaving = true
        let result = PracticeResult(
            outcome: outcome,
            reflection: String(reflection.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2_000))
        )
        Task {
            let succeeded = completesTask
                ? await store.completeLifeTask(task.id, minutesSpent: minutesSpent, result: result)
                : await store.reflectOnPractice(task.id, result: result)
            isSaving = false
            if succeeded {
                onSaved()
                dismiss()
            }
        }
    }
}
