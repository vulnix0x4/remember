import FamilyControls
import SwiftUI

// The building blocks of Settings. The first-run setup flow shows the same sections one at a time.

/// Early bird, Regular, Night owl, or Custom. Writes Jev's planning hours.
struct YourDaySection: View {
    @Environment(AppStore.self) private var store
    @State private var showsCustom = false
    @State private var wake = Date.now
    @State private var windDown = Date.now

    private enum Preset: CaseIterable {
        case earlyBird, regular, nightOwl

        var title: String {
            switch self {
            case .earlyBird: "Early bird"
            case .regular: "Regular"
            case .nightOwl: "Night owl"
            }
        }
        var hours: (start: Int, end: Int) {
            switch self {
            case .earlyBird: (6, 21)
            case .regular: (8, 22)
            case .nightOwl: (12, 3)
            }
        }
        var symbol: String {
            switch self {
            case .earlyBird: "sunrise"
            case .regular: "sun.max"
            case .nightOwl: "moon.stars"
            }
        }
    }

    private var settings: BrainSettings? { store.brain?.settings }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            if let settings {
                ForEach(Preset.allCases, id: \.self) { preset in
                    let isOn = !showsCustom && settings.startHour == preset.hours.start && settings.endHour == preset.hours.end
                    optionRow(preset.title, detail: "\(hourLabel(preset.hours.start)) – \(hourLabel(preset.hours.end))", symbol: preset.symbol, isOn: isOn) {
                        showsCustom = false
                        Task { await store.updateBrainSettings { $0.startHour = preset.hours.start; $0.endHour = preset.hours.end } }
                    }
                }
                let isCustom = showsCustom || !Preset.allCases.contains { settings.startHour == $0.hours.start && settings.endHour == $0.hours.end }
                optionRow("Custom", detail: isCustom ? "\(hourLabel(settings.startHour)) – \(hourLabel(settings.endHour))" : "Pick your own hours", symbol: "slider.horizontal.3", isOn: isCustom) {
                    showsCustom = true
                }
                if isCustom {
                    VStack(spacing: 0) {
                        DatePicker("I wake up", selection: $wake, displayedComponents: .hourAndMinute)
                            .frame(minHeight: RememberDesign.rowHeight)
                        Rectangle().fill(RememberDesign.line).frame(height: 0.5)
                        DatePicker("I wind down", selection: $windDown, displayedComponents: .hourAndMinute)
                            .frame(minHeight: RememberDesign.rowHeight)
                    }
                    .font(.rememberRowTitle)
                    .padding(.horizontal, RememberDesign.spacing)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                    .onChange(of: wake) { saveCustom() }
                    .onChange(of: windDown) { saveCustom() }
                }
                Toggle(isOn: Binding(get: { settings.enabled }, set: { value in
                    Task { await store.updateBrainSettings { $0.enabled = value } }
                })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Let Jev plan my day").font(.rememberRowTitle)
                        Text("Jev picks what's next and when").font(.footnote).foregroundStyle(RememberDesign.text3)
                    }
                }
                .tint(RememberDesign.accent)
                .padding(.horizontal, RememberDesign.spacing)
                .frame(minHeight: 64)
                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
            } else {
                Text(store.brainError ?? "Connect to your Remember server so Jev can plan your day.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .rememberCard(padding: RememberDesign.spacing)
            }
        }
        .onAppear {
            guard let settings else { return }
            wake = Calendar.current.date(bySettingHour: settings.startHour, minute: 0, second: 0, of: .now) ?? .now
            windDown = Calendar.current.date(bySettingHour: settings.endHour % 24, minute: 0, second: 0, of: .now) ?? .now
        }
    }

    private func saveCustom() {
        let start = Calendar.current.component(.hour, from: wake)
        var end = Calendar.current.component(.hour, from: windDown)
        if end == 0 { end = 24 }
        guard start != end % 24 else { return }
        Task { await store.updateBrainSettings { $0.startHour = start; $0.endHour = end } }
    }

    private func hourLabel(_ hour: Int) -> String {
        let date = Calendar.current.date(bySettingHour: hour % 24, minute: 0, second: 0, of: .now) ?? .now
        return date.formatted(.dateTime.hour())
    }

    private func optionRow(_ title: String, detail: String, symbol: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: RememberDesign.spacingCompact) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(isOn ? RememberDesign.accent : RememberDesign.text3)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.rememberRowTitle).foregroundStyle(RememberDesign.text)
                    Text(detail).font(.footnote).foregroundStyle(RememberDesign.text3)
                }
                Spacer()
                if isOn {
                    Image(systemName: "checkmark").font(.body.weight(.bold)).foregroundStyle(RememberDesign.accent)
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .frame(minHeight: 64)
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
            .overlay {
                RoundedRectangle(cornerRadius: RememberDesign.controlRadius)
                    .strokeBorder(isOn ? RememberDesign.accent.opacity(0.6) : .clear, lineWidth: 1.5)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

/// Commitments or chores: the list, an add row, and one-tap templates.
struct CommitmentsSection: View {
    @Environment(AppStore.self) private var store
    let kind: CommitmentKind
    @State private var editing: EditorTarget?

    private struct EditorTarget: Identifiable {
        let id = UUID()
        var existing: Commitment?
        var template: CommitmentDraft?
    }

    private var items: [Commitment] { store.lifeSnapshot.allCommitments.filter { $0.kind == kind } }
    private var unusedTemplates: [CommitmentDraft] {
        let titles = Set(items.map { $0.title.lowercased() })
        return CommitmentTemplates.templates(for: kind).filter { !titles.contains($0.title.lowercased()) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
            VStack(spacing: 0) {
                ForEach(items) { item in
                    Button {
                        editing = EditorTarget(existing: item)
                    } label: {
                        HStack(spacing: RememberDesign.spacingCompact) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.body).foregroundStyle(RememberDesign.text)
                                Text(item.summary).font(.footnote).foregroundStyle(RememberDesign.text3)
                            }
                            Spacer()
                            if item.importance == .must {
                                Text("Must do")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(RememberDesign.accent)
                            }
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(RememberDesign.text3)
                        }
                        .padding(.horizontal, RememberDesign.spacing)
                        .padding(.vertical, 12)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    Rectangle().fill(RememberDesign.line).frame(height: 0.5).padding(.leading, RememberDesign.spacing)
                }
                Button {
                    editing = EditorTarget()
                } label: {
                    Label(kind == .chore ? "Add a chore" : "Add a commitment", systemImage: "plus")
                        .font(.body.weight(.medium))
                        .foregroundStyle(RememberDesign.text2)
                        .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                        .padding(.horizontal, RememberDesign.spacing)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))

            if !unusedTemplates.isEmpty {
                Text(items.isEmpty ? "Tap one to start" : "Ideas")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(RememberDesign.text3)
                FlowLayout(spacing: RememberDesign.spacingSmall) {
                    ForEach(unusedTemplates, id: \.title) { template in
                        Button {
                            editing = EditorTarget(template: template)
                        } label: {
                            Label(template.title, systemImage: "plus")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(RememberDesign.text)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 40)
                                .background(RememberDesign.cardRaised, in: .capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .sheet(item: $editing) { target in
            CommitmentEditorSheet(existing: target.existing, kind: kind, template: target.template)
        }
    }
}

/// Screen Time blocking while locked in on a task.
struct FocusModeSection: View {
    @Environment(FocusShield.self) private var shield
    @State private var pickerIsPresented = false
    @State private var authorizationFailed = false

    var body: some View {
        @Bindable var shield = shield
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Toggle(isOn: Binding(get: { shield.isEnabled && shield.isAuthorized }, set: { value in
                Task {
                    if value, !shield.isAuthorized {
                        authorizationFailed = !(await shield.requestAuthorization())
                    }
                    shield.isEnabled = value && shield.isAuthorized
                    if shield.isEnabled && !shield.hasApps { pickerIsPresented = true }
                }
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Block distracting apps").font(.rememberRowTitle)
                    Text("While you're locked in on a task").font(.footnote).foregroundStyle(RememberDesign.text3)
                }
            }
            .tint(RememberDesign.accent)
            .padding(.horizontal, RememberDesign.spacing)
            .frame(minHeight: 64)
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))

            if shield.isEnabled && shield.isAuthorized {
                Button {
                    pickerIsPresented = true
                } label: {
                    HStack {
                        Text("Apps to block").font(.body).foregroundStyle(RememberDesign.text)
                        Spacer()
                        Text(shield.selectionSummary).font(.subheadline).foregroundStyle(RememberDesign.text3)
                        Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(RememberDesign.text3)
                    }
                    .padding(.horizontal, RememberDesign.spacing)
                    .frame(minHeight: 56)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)

                ChoiceGroup(title: "Usual focus length") {
                    ForEach([25, 45, 60, 90], id: \.self) { minutes in
                        ChoiceChip(label: minutes.durationLabel, isOn: shield.defaultMinutes == minutes) { shield.defaultMinutes = minutes }
                    }
                }
            }
            if authorizationFailed {
                Text("Screen Time access wasn't granted. You can allow it in the Settings app under Screen Time.")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
        }
        .familyActivityPicker(isPresented: $pickerIsPresented, selection: $shield.selection)
    }
}

/// Gentle local notifications.
struct NudgesSection: View {
    @Environment(Nudges.self) private var nudges

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Toggle(isOn: Binding(get: { nudges.isEnabled && nudges.isAuthorized }, set: { value in
                Task {
                    if value { await nudges.enable() } else { nudges.disable() }
                }
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Gentle reminders").font(.rememberRowTitle)
                    Text("Next thing, wrap-up, washer done. Never repeated.").font(.footnote).foregroundStyle(RememberDesign.text3)
                }
            }
            .tint(RememberDesign.accent)
            .padding(.horizontal, RememberDesign.spacing)
            .frame(minHeight: 64)
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
        }
    }
}

/// Free text Jev uses when planning.
struct AboutMeSection: View {
    @Environment(AppStore.self) private var store
    @State private var text = ""
    @State private var saved = ""

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            TextField("I focus best at night. Never schedule chores before class.", text: $text, axis: .vertical)
                .lineLimit(3...8)
                .padding(RememberDesign.spacing)
                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                .disabled(store.brain == nil)
            if text != saved {
                Button("Save") {
                    let value = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2000))
                    Task {
                        if await store.updateBrainSettings({ $0.preferences = value }) {
                            saved = value
                            store.showToast("Jev will keep that in mind")
                        }
                    }
                }
                .buttonStyle(.rememberSecondary)
            }
        }
        .onAppear {
            text = store.brain?.settings.preferences ?? ""
            saved = text
        }
    }
}
