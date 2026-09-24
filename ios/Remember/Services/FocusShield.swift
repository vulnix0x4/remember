import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import Observation

extension ManagedSettingsStore.Name {
    /// Shared with the device-activity monitor extension, which clears it when a focus block ends.
    static var rememberFocus: Self { Self("remember.focus") }
}

extension DeviceActivityName {
    static var rememberFocus: Self { Self("remember.focus") }
}

/// Blocks the apps the person chose while they're locked in on a task, using Screen Time.
@Observable @MainActor
final class FocusShield {
    private(set) var isAuthorized: Bool
    private(set) var isShielding = false
    var isEnabled: Bool { didSet { defaults.set(isEnabled, forKey: Keys.enabled) } }
    var defaultMinutes: Int { didSet { defaults.set(defaultMinutes, forKey: Keys.minutes) } }
    var selection: FamilyActivitySelection { didSet { persistSelection() } }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let store = ManagedSettingsStore(named: .rememberFocus)

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        isAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
        isEnabled = defaults.bool(forKey: Keys.enabled)
        defaultMinutes = defaults.object(forKey: Keys.minutes) as? Int ?? 45
        if let data = defaults.data(forKey: Keys.selection),
           let saved = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
            selection = saved
        } else {
            selection = FamilyActivitySelection()
        }
    }

    var hasApps: Bool {
        !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty
    }

    var selectionSummary: String {
        let apps = selection.applicationTokens.count, categories = selection.categoryTokens.count
        if apps == 0 && categories == 0 { return "No apps chosen" }
        var parts: [String] = []
        if categories > 0 { parts.append(categories == 1 ? "1 category" : "\(categories) categories") }
        if apps > 0 { parts.append(apps == 1 ? "1 app" : "\(apps) apps") }
        return parts.joined(separator: ", ")
    }

    /// Asks for Screen Time access for this person's own device. Returns true when granted.
    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        } catch {
            isAuthorized = false
            return false
        }
        isAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
        return isAuthorized
    }

    /// Shields the chosen apps for `minutes`. A device-activity interval lifts the shield even if the app is closed.
    func begin(minutes: Int) {
        guard isEnabled, isAuthorized, hasApps else { return }
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        isShielding = true

        // Device-activity intervals must be at least 15 minutes; the app ends focus earlier when needed.
        let start = Date.now
        let end = start.addingTimeInterval(TimeInterval(max(15, minutes) * 60))
        let calendar = Calendar.current
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: start),
            intervalEnd: calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: end),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.rememberFocus])
        try? center.startMonitoring(.rememberFocus, during: schedule)
    }

    func end() {
        store.clearAllSettings()
        DeviceActivityCenter().stopMonitoring([.rememberFocus])
        isShielding = false
    }

    private func persistSelection() {
        if let data = try? PropertyListEncoder().encode(selection) {
            defaults.set(data, forKey: Keys.selection)
        }
    }

    private enum Keys {
        static let enabled = "remember.focus.blockingEnabled"
        static let minutes = "remember.focus.defaultMinutes"
        static let selection = "remember.focus.selection"
    }
}
