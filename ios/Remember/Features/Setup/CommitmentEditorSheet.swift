import SwiftUI

/// Add or change a commitment (college study, gym) or a chore (laundry). Everything is a tap.
struct CommitmentEditorSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let existing: Commitment?
    @State private var draft: CommitmentDraft
    @State private var hasFixedTime: Bool
    @State private var fixedTime: Date
    @State private var isSaving = false

    init(existing: Commitment? = nil, kind: CommitmentKind = .commitment, template: CommitmentDraft? = nil) {
        self.existing = existing
        let initial = existing.map(CommitmentDraft.init) ?? template ?? CommitmentDraft(
            title: "", kind: kind, everyDays: kind == .chore ? 7 : nil,
            durationMinutes: kind == .chore ? 30 : 60, importance: kind == .chore ? .high : .must
        )
        _draft = State(initialValue: initial)
        _hasFixedTime = State(initialValue: initial.fixedStart != nil)
        _fixedTime = State(initialValue: initial.fixedStart.flatMap(CommitmentTime.date(from:))
            ?? Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: .now) ?? .now)
    }

    private var isChore: Bool { draft.kind == .chore }
    private var canSave: Bool { !draft.title.trimmingCharacters(in: .whitespaces).isEmpty && draft.days > 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    TextField(isChore ? "Chore, like Laundry" : "Commitment, like College study", text: $draft.title, axis: .vertical)
                        .font(.rememberHero)
                        .lineLimit(1...3)
                        .accessibilityLabel("Name")

                    if isChore {
                        ChoiceGroup(title: "How often") {
                            ForEach([1, 3, 7, 14, 30], id: \.self) { days in
                                ChoiceChip(label: days == 3 ? "Every few days" : days.repeatLabel, isOn: draft.everyDays == days) {
                                    draft.everyDays = days
                                }
                            }
                        }
                    }

                    daysPicker

                    if !isChore {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            SectionHeading(title: "Time")
                            HStack(spacing: RememberDesign.spacingSmall) {
                                ChoiceChip(label: "Jev picks", isOn: !hasFixedTime) { hasFixedTime = false }
                                ChoiceChip(label: "At a set time", isOn: hasFixedTime) { hasFixedTime = true }
                            }
                            if hasFixedTime {
                                DatePicker("Starts at", selection: $fixedTime, displayedComponents: .hourAndMinute)
                                    .font(.rememberRowTitle)
                                    .padding(.horizontal, RememberDesign.spacing)
                                    .frame(minHeight: RememberDesign.rowHeight)
                                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                            }
                        }
                    }

                    ChoiceGroup(title: isChore ? "Active time" : "How long") {
                        ForEach(Set([15, 30, 45, 60, 90, 120, 180, draft.durationMinutes]).sorted(), id: \.self) { minutes in
                            ChoiceChip(label: minutes.durationLabel, isOn: draft.durationMinutes == minutes) {
                                draft.durationMinutes = minutes
                            }
                        }
                    }

                    importancePicker

                    if isChore { StepsEditor(steps: $draft.steps) }
                }
                .padding(RememberDesign.spacing)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(RememberDesign.canvas)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: RememberDesign.spacingXXSmall) {
                    Button(existing == nil ? "Add" : "Save", action: save)
                        .buttonStyle(.rememberPrimary)
                        .disabled(!canSave || isSaving)
                    if let existing {
                        Button("Remove", role: .destructive) {
                            dismiss()
                            Task { await store.deleteCommitment(existing) }
                        }
                        .buttonStyle(.rememberDanger)
                    }
                }
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.vertical, RememberDesign.spacingSmall)
                .background(RememberDesign.canvas)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private var daysPicker: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: isChore ? "Best days" : "Days", trailing: isChore && draft.days == Weekdays.everyDay ? "Any day" : nil)
            HStack(spacing: 6) {
                ForEach(0..<7, id: \.self) { weekday in
                    let isOn = Weekdays.contains(draft.days, weekday)
                    Button {
                        let toggled = draft.days ^ (1 << weekday)
                        draft.days = toggled == 0 ? Weekdays.everyDay : toggled
                    } label: {
                        Text(Weekdays.letters[weekday])
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(isOn ? RememberDesign.primaryInk : RememberDesign.text2)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(isOn ? RememberDesign.primaryFill : RememberDesign.cardRaised, in: .circle)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Weekdays.names[weekday])
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
            HStack(spacing: RememberDesign.spacingSmall) {
                ChoiceChip(label: isChore ? "Any day" : "Every day", isOn: draft.days == Weekdays.everyDay) { draft.days = Weekdays.everyDay }
                ChoiceChip(label: "Weekdays", isOn: draft.days == Weekdays.weekdays) { draft.days = Weekdays.weekdays }
                ChoiceChip(label: "Weekends", isOn: draft.days == (1 | 64)) { draft.days = 1 | 64 }
            }
        }
    }

    private var importancePicker: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "How important")
            ForEach(CommitmentImportance.allCases, id: \.self) { level in
                let isOn = draft.importance == level
                Button {
                    draft.importance = level
                } label: {
                    HStack(spacing: RememberDesign.spacingCompact) {
                        Image(systemName: isOn ? "largecircle.fill.circle" : "circle")
                            .font(.title3)
                            .foregroundStyle(isOn ? RememberDesign.accent : RememberDesign.text3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(level.label).font(.rememberRowTitle).foregroundStyle(RememberDesign.text)
                            Text(level.detail).font(.footnote).foregroundStyle(RememberDesign.text3)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .frame(minHeight: 60)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
    }

    private func save() {
        guard canSave, !isSaving else { return }
        isSaving = true
        var final = draft
        final.title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        final.fixedStart = !isChore && hasFixedTime ? CommitmentTime.string(from: fixedTime) : nil
        final.steps = draft.steps.filter { !$0.title.trimmingCharacters(in: .whitespaces).isEmpty }
        Task {
            if await store.saveCommitment(id: existing?.id, final) {
                store.showToast(existing == nil ? "Added · Jev will plan it" : "Saved")
                dismiss()
            }
            isSaving = false
        }
    }
}

/// An editable list of routine steps; each can include a hands-off wait.
private struct StepsEditor: View {
    @Binding var steps: [RoutineStep]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Steps", trailing: steps.isEmpty ? "Optional" : nil)
            VStack(spacing: 0) {
                ForEach($steps) { $step in
                    HStack(spacing: RememberDesign.spacingSmall) {
                        Text("\((steps.firstIndex { $0.id == step.id } ?? 0) + 1)")
                            .font(.footnote.weight(.bold).monospacedDigit())
                            .foregroundStyle(RememberDesign.text3)
                            .frame(width: 20)
                        TextField("Step", text: $step.title)
                        Menu {
                            Button("No wait") { step.waitMinutes = nil }
                            ForEach([10, 20, 30, 45, 50, 60, 90], id: \.self) { minutes in
                                Button("Wait \(minutes) min") { step.waitMinutes = minutes }
                            }
                        } label: {
                            Label(step.waitMinutes.map { "\($0)m wait" } ?? "Wait", systemImage: "hourglass")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(step.waitMinutes == nil ? RememberDesign.text3 : RememberDesign.accent)
                                .frame(minHeight: 44)
                        }
                        .accessibilityLabel(step.waitMinutes.map { "Wait \($0) minutes" } ?? "Add a wait")
                        Button {
                            steps.removeAll { $0.id == step.id }
                        } label: {
                            Image(systemName: "minus.circle")
                                .foregroundStyle(RememberDesign.text3)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove step")
                    }
                    .padding(.leading, RememberDesign.spacing)
                    if step.id != steps.last?.id {
                        Rectangle().fill(RememberDesign.line).frame(height: 0.5).padding(.leading, 44)
                    }
                }
                Button {
                    steps.append(RoutineStep(title: ""))
                } label: {
                    Label("Add a step", systemImage: "plus")
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .padding(.leading, RememberDesign.spacing)
                }
                .buttonStyle(.plain)
                .foregroundStyle(RememberDesign.text2)
            }
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
            Text("Add a wait for hands-off time, like the washer. The app times it and nudges you.")
                .font(.footnote)
                .foregroundStyle(RememberDesign.text3)
        }
    }
}
