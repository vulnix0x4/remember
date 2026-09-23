import SwiftUI

/// A one-line status under the Today title. Tapping it opens Jev's settings.
struct JevStatusLine: View {
    @Environment(AppStore.self) private var store
    @State private var isPresented = false

    private var isOn: Bool { store.brain?.settings.enabled == true }

    var body: some View {
        Button {
            isPresented = true
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(isOn ? RememberDesign.accent : RememberDesign.text3)
                    .frame(width: 8, height: 8)
                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isOn ? .white : RememberDesign.text2)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RememberDesign.text3)
            }
            .frame(minHeight: 36)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens Jev’s planning settings")
        .accessibilityIdentifier("remember.jev.status")
        .sheet(isPresented: $isPresented) { JevSheet() }
    }

    private var label: String {
        if store.brainError != nil { return "Jev can’t reach your plan right now" }
        guard let brain = store.brain else { return "Jev isn’t connected yet" }
        if store.isUpdatingBrain { return "Jev is updating your plan…" }
        return brain.settings.enabled ? "Jev is planning your day" : "Jev is paused"
    }
}

struct JevSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var enabled = false
    @State private var preferences = ""
    @State private var start = JevSheet.time(hour: 8)
    @State private var end = JevSheet.time(hour: 21)
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    Text("Jev looks at your tasks, calendar and goals, then decides what you should do next and when. You can always change it.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.text2)

                    if let brain = store.brain {
                        Toggle(isOn: $enabled) {
                            Text("Let Jev plan my day").font(.rememberRowTitle)
                        }
                        .tint(RememberDesign.accent)
                        .padding(.horizontal, RememberDesign.spacing)
                        .frame(minHeight: RememberDesign.rowHeight)
                        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))

                        VStack(spacing: 0) {
                            DatePicker("My day starts", selection: $start, displayedComponents: .hourAndMinute)
                                .frame(minHeight: RememberDesign.rowHeight)
                            Divider().overlay(RememberDesign.line)
                            DatePicker("My day ends", selection: $end, displayedComponents: .hourAndMinute)
                                .frame(minHeight: RememberDesign.rowHeight)
                            if endsNextDay {
                                Text("Ends the next day, after midnight.")
                                    .font(.footnote)
                                    .foregroundStyle(RememberDesign.text2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.bottom, RememberDesign.spacingCompact)
                            }
                        }
                        .font(.rememberRowTitle)
                        .padding(.horizontal, RememberDesign.spacing)
                        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))

                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            SectionHeading(title: "What Jev should know")
                            TextField("e.g. I focus best in the morning. No chores after 9 PM.", text: $preferences, axis: .vertical)
                                .lineLimit(3...8)
                                .padding(RememberDesign.spacing)
                                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                        }

                        if let evaluatedAt = brain.evaluatedAt {
                            Text("Last planned \(evaluatedAt.formatted(.relative(presentation: .named)))")
                                .font(.footnote)
                                .foregroundStyle(RememberDesign.text3)
                        }
                    } else {
                        RememberEmptyState(
                            systemImage: "sparkles",
                            title: "Jev isn’t connected",
                            message: store.brainError ?? "Connect your Remember server with its OpenRouter key to turn on automatic planning. Your tasks still work without it."
                        )
                    }

                    if let error = error ?? store.brainError {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.danger)
                    }
                }
                .padding(RememberDesign.spacing)
            }
            .background(RememberDesign.canvas)
            .navigationTitle("Jev")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: saveAndClose)
                        .fontWeight(.semibold)
                        .disabled(store.isUpdatingBrain)
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
        .onAppear(perform: load)
    }

    private func load() {
        guard let settings = store.brain?.settings else { return }
        enabled = settings.enabled
        preferences = settings.preferences
        start = Self.time(hour: settings.startHour)
        end = Self.time(hour: settings.endHour)
    }

    private var endsNextDay: Bool {
        let startHour = Calendar.current.component(.hour, from: start)
        let endHour = Calendar.current.component(.hour, from: end)
        return endHour != 0 && endHour < startHour
    }

    private func saveAndClose() {
        guard var settings = store.brain?.settings else { dismiss(); return }
        let startHour = Calendar.current.component(.hour, from: start)
        var endHour = Calendar.current.component(.hour, from: end)
        if endHour == 0 { endHour = 24 }
        guard endHour != startHour else { error = "Your day can’t start and end at the same hour."; return }
        let updated = BrainSettings(
            enabled: enabled, timeZone: settings.timeZone, startHour: startHour, endHour: endHour,
            preferences: String(preferences.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2000))
        )
        guard updated != settings else { dismiss(); return }
        settings = updated
        Task {
            if await store.refreshBrain(settings: settings) {
                dismiss()
            } else {
                error = "Couldn’t save. Try again."
            }
        }
    }

    private static func time(hour: Int) -> Date {
        Calendar.current.date(bySettingHour: min(hour, 23), minute: 0, second: 0, of: .now) ?? .now
    }
}
