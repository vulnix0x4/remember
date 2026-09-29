import FamilyControls
import SwiftUI

/// Settings → Sleep: phone-free nights, the phone-free morning, the caffeine nudge, and the phone lock.
struct SleepSection: View {
    @Environment(AppStore.self) private var store
    @Environment(SleepGuard.self) private var sleepGuard
    @State private var pickerIsPresented = false
    @State private var authorizationFailed = false

    private var sleep: SleepSettings { store.sleep }

    var body: some View {
        @Bindable var sleepGuard = sleepGuard
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            if store.brain == nil {
                Text(store.brainError ?? "Connect to your Remember server to set up sleep.")
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .rememberCard(padding: RememberDesign.spacing)
            } else {
                toggleRow("Phone-free nights", detail: "Tap Going to bed; get your phone back after you're up", isOn: sleep.enabled, identifier: "remember.sleep.enabled") { value in
                    Task { await store.updateSleep { $0.enabled = value } }
                }
                if sleep.enabled {
                    ChoiceGroup(title: "Phone-free after waking") {
                        ForEach([0, 30, 60, 90], id: \.self) { minutes in
                            ChoiceChip(label: minutes == 0 ? "Off" : minutes.sleepChipLabel, isOn: sleep.morningMinutes == minutes) {
                                Task { await store.updateSleep { $0.morningMinutes = minutes } }
                            }
                        }
                    }
                    .padding(.top, RememberDesign.spacingSmall)
                    toggleRow("Caffeine reminder", detail: "8 hours before your usual bedtime", isOn: sleep.caffeineReminder, identifier: "remember.sleep.caffeine") { value in
                        Task { await store.updateSleep { $0.caffeineReminder = value } }
                    }
                    .padding(.top, RememberDesign.spacingSmall)
                    lockRows
                }
            }
        }
        .familyActivityPicker(isPresented: $pickerIsPresented, selection: $sleepGuard.allowed)
    }

    @ViewBuilder
    private var lockRows: some View {
        toggleRow("Lock my phone", detail: "Blocks apps while phone-free. Calls and alarms still work.",
                  isOn: sleepGuard.isLocking && sleepGuard.isAuthorized, identifier: "remember.sleep.lock") { value in
            Task {
                if value, !sleepGuard.isAuthorized {
                    authorizationFailed = !(await sleepGuard.requestAuthorization())
                }
                sleepGuard.isLocking = value && sleepGuard.isAuthorized
            }
        }
        .padding(.top, RememberDesign.spacingSmall)
        if sleepGuard.isLocking && sleepGuard.isAuthorized {
            Button {
                pickerIsPresented = true
            } label: {
                HStack {
                    Text("Apps you can still use").font(.body).foregroundStyle(RememberDesign.text)
                    Spacer()
                    Text(sleepGuard.allowedSummary).font(.subheadline).foregroundStyle(RememberDesign.text3)
                    Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(RememberDesign.text3)
                }
                .padding(.horizontal, RememberDesign.spacing)
                .frame(minHeight: RememberDesign.rowHeight)
                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("remember.sleep.allowed")
        }
        if authorizationFailed {
            Text("Screen Time access wasn't granted. You can allow it in the Settings app under Screen Time.")
                .font(.footnote)
                .foregroundStyle(RememberDesign.danger)
        }
    }

    private func toggleRow(_ title: String, detail: String, isOn: Bool, identifier: String, set: @escaping (Bool) -> Void) -> some View {
        Toggle(isOn: Binding(get: { isOn }, set: set)) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.rememberRowTitle)
                Text(detail).font(.footnote).foregroundStyle(RememberDesign.text3)
            }
        }
        .tint(RememberDesign.accent)
        .padding(.horizontal, RememberDesign.spacing)
        .frame(minHeight: 64)
        .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
        .accessibilityIdentifier(identifier)
    }
}

private extension Int {
    /// 30 → "30 min", 60 → "1 hr", 90 → "1.5 hr".
    var sleepChipLabel: String {
        if self < 60 { return "\(self) min" }
        return self % 60 == 0 ? "\(self / 60) hr" : "\((Double(self) / 60).formatted(.number.precision(.fractionLength(1)))) hr"
    }
}
