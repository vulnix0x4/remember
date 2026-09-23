import SwiftUI

/// Change a task by tapping chips. Saves automatically when closed.
struct TaskEditorSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(FocusTimer.self) private var timer
    @Environment(\.dismiss) private var dismiss
    let task: LifeTask

    @State private var title: String
    @State private var firstStep: String
    @State private var duration: Int
    @State private var when: WhenChoice
    @State private var repeatDays: Int?
    @State private var isImportant: Bool
    @State private var isDeleting = false
    @State private var didSave = false

    init(task: LifeTask) {
        self.task = task
        _title = State(initialValue: task.title)
        _firstStep = State(initialValue: task.firstStep)
        _duration = State(initialValue: task.durationMinutes)
        _when = State(initialValue: WhenChoice.matching(task.notBefore))
        _repeatDays = State(initialValue: task.repeatEveryDays)
        _isImportant = State(initialValue: task.priority == .high || task.priority == .must)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    TextField("Task", text: $title, axis: .vertical)
                        .font(.rememberHero)
                        .lineLimit(1...4)
                        .submitLabel(.done)
                        .accessibilityLabel("Task name")

                    TextField("Start with… (optional)", text: $firstStep, axis: .vertical)
                        .font(.body)
                        .lineLimit(1...4)
                        .padding(RememberDesign.spacing)
                        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                        .accessibilityLabel("First step")

                    chipGroup("How long") {
                        ForEach(Set([5, 15, 30, 60, 90, task.durationMinutes]).sorted(), id: \.self) { minutes in
                            chip(minutes.durationLabel, isOn: duration == minutes) { duration = minutes }
                        }
                    }

                    chipGroup("When") {
                        ForEach(WhenChoice.allCases, id: \.self) { choice in
                            chip(choice.label, isOn: when == choice) { when = choice }
                        }
                        if when == .custom, let date = task.notBefore {
                            chip(date.relativeDayLabel, isOn: true) {}
                        }
                    }

                    chipGroup("Repeat") {
                        ForEach(repeatChoices, id: \.self) { days in
                            chip(days?.repeatLabel ?? "Never", isOn: repeatDays == days) { repeatDays = days }
                        }
                    }

                    Toggle(isOn: $isImportant) {
                        Label("Important", systemImage: "exclamationmark.circle")
                            .font(.rememberRowTitle)
                    }
                    .tint(RememberDesign.accent)
                    .padding(.horizontal, RememberDesign.spacing)
                    .frame(minHeight: RememberDesign.rowHeight)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                }
                .padding(RememberDesign.spacing)
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: RememberDesign.spacingXXSmall) {
                    if task.status != .active {
                        Button {
                            save()
                            dismiss()
                            timer.start(task.id)
                            Task { await store.startTask(task) }
                        } label: {
                            Label("Start now", systemImage: "play.fill")
                        }
                        .buttonStyle(.rememberPrimary)
                    }
                    Button("Delete task", role: .destructive) {
                        isDeleting = true
                        dismiss()
                        Task { await store.deleteTask(task) }
                    }
                    .buttonStyle(.rememberDanger)
                }
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.vertical, RememberDesign.spacingSmall)
                .background(RememberDesign.canvas)
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
            .background(RememberDesign.canvas)
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
        .onDisappear { if !isDeleting { save() } }
    }

    private var repeatChoices: [Int?] {
        let base: [Int?] = [nil, 1, 7, 30]
        guard let current = task.repeatEveryDays, !base.contains(current) else { return base }
        return base + [current]
    }

    private func chipGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: title)
            ScrollView(.horizontal) {
                HStack(spacing: RememberDesign.spacingSmall) { content() }
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
        }
    }

    private func chip(_ label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isOn ? RememberDesign.canvas : .white)
                .padding(.horizontal, RememberDesign.spacing)
                .frame(minHeight: 44)
                .background(isOn ? RememberDesign.primaryFill : RememberDesign.cardRaised, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: isOn)
    }

    private func save() {
        guard !didSave else { return }
        didSave = true
        var patch = LifeTaskPatch()
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleanTitle.isEmpty, cleanTitle != task.title { patch.title = cleanTitle }
        let cleanStep = firstStep.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanStep != task.firstStep { patch.firstStep = cleanStep }
        if duration != task.durationMinutes { patch.durationMinutes = duration }
        if when != WhenChoice.matching(task.notBefore) { patch.notBefore = .some(when.date()) }
        if repeatDays != task.repeatEveryDays { patch.repeatEveryDays = .some(repeatDays) }
        let wasImportant = task.priority == .high || task.priority == .must
        if isImportant != wasImportant { patch.priority = isImportant ? .high : .normal }
        guard !patch.isEmpty else { return }
        Task { await store.patchTask(task.id, patch, quietly: true) }
    }
}

private enum WhenChoice: CaseIterable, Hashable {
    case anytime, tonight, tomorrow, weekend, nextWeek, custom

    static var allCases: [WhenChoice] { [.anytime, .tonight, .tomorrow, .weekend, .nextWeek] }

    var label: String {
        switch self {
        case .anytime: "Anytime"
        case .tonight: "Tonight"
        case .tomorrow: "Tomorrow"
        case .weekend: "This weekend"
        case .nextWeek: "Next week"
        case .custom: "Custom"
        }
    }

    private var phrase: String? {
        switch self {
        case .anytime, .custom: nil
        case .tonight: "tonight"
        case .tomorrow: "tomorrow"
        case .weekend: "this weekend"
        case .nextWeek: "next week"
        }
    }

    func date(now: Date = .now) -> Date? {
        guard let phrase else { return nil }
        return QuickTaskParser.parse("x \(phrase)", now: now).notBefore
    }

    static func matching(_ date: Date?) -> WhenChoice {
        guard let date, date > .now else { return .anytime }
        return allCases.first { $0.date() == date } ?? .custom
    }
}
