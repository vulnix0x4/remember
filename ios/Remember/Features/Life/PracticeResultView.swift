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
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text("Did it help?")
                            .font(.rememberHero)
                            .accessibilityAddTraits(.isHeader)
                        Text(task.title)
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                            .lineLimit(2)
                    }

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        ForEach(PracticeOutcome.allCases, id: \.self) { choice in
                            let isSelected = outcome == choice
                            Button {
                                outcome = choice
                            } label: {
                                HStack(spacing: RememberDesign.spacingCompact) {
                                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                        .font(.title2)
                                        .foregroundStyle(isSelected ? RememberDesign.accent : RememberDesign.text3)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(choice.label)
                                            .font(.rememberRowTitle)
                                            .foregroundStyle(.white)
                                        Text(choice.meaning)
                                            .font(.subheadline)
                                            .foregroundStyle(RememberDesign.text2)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, RememberDesign.spacing)
                                .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                                .background(isSelected ? RememberDesign.cardRaised : RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                                .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("remember.practice-result.\(choice.rawValue)")
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                        }
                    }
                    .sensoryFeedback(.selection, trigger: outcome)

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        SectionHeading(title: "What did you notice?", trailing: "Optional")
                        TextField("One line is plenty", text: $reflection, axis: .vertical)
                            .lineLimit(3...8)
                            .padding(RememberDesign.spacing)
                            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                            .accessibilityLabel("What did you notice?")
                            .accessibilityIdentifier("remember.practice-result.note")
                    }
                }
                .padding(RememberDesign.spacing)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(RememberDesign.canvas)
            .rememberPrimaryFooter(
                isEnabled: outcome != nil && !isSaving,
                accessibilityIdentifier: "remember.practice-result.save",
                action: save
            ) {
                Label(completesTask ? "Done" : "Save", systemImage: "checkmark")
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                        .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.large])
        .rememberSheetPresentation()
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
