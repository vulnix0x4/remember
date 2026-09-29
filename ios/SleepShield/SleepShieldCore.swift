import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

extension ManagedSettingsStore.Name {
    /// Separate from lock-in's store, so ending a focus block never lifts the night's shield.
    static var rememberSleep: Self { Self("remember.sleep") }
}

extension DeviceActivityName {
    /// From Going to bed to the 14-hour cap.
    static var rememberSleep: Self { Self("remember.sleep") }
    /// From I'm up to the end of the phone-free morning.
    static var rememberSleepMorning: Self { Self("remember.sleep.morning") }
    /// A one-off 15-minute unlock.
    static var rememberSleepPause: Self { Self("remember.sleep.pause") }
}

/// Tonight, from the two taps. Lives in the app group so the device-activity monitor can decide on its own.
struct SleepSession: Codable, Equatable, Sendable {
    enum Phase: Equatable, Sendable { case windDown, sleep, morning }

    static let windDownMinutes = 60
    static let maxHours = 14

    var bedAt: Date
    var upAt: Date?
    /// Phone-free time after I'm up, as it was set when the night started.
    var morningMinutes: Int
    var pausedUntil: Date?
    /// Unlocks used tonight, so the morning can say so plainly.
    var unlocks = 0

    var windDownEnds: Date { bedAt.addingTimeInterval(TimeInterval(Self.windDownMinutes * 60)) }
    var cap: Date { bedAt.addingTimeInterval(TimeInterval(Self.maxHours * 3600)) }
    /// When phone-free is over: after the phone-free morning, and never past the cap.
    var ends: Date {
        guard let upAt else { return cap }
        return min(upAt.addingTimeInterval(TimeInterval(morningMinutes * 60)), cap)
    }

    func phase(at date: Date) -> Phase? {
        guard date >= bedAt, date < ends else { return nil }
        if let upAt, date >= upAt { return .morning }
        return date < windDownEnds ? .windDown : .sleep
    }

    func isPaused(at date: Date) -> Bool { pausedUntil.map { date < $0 } ?? false }

    /// The one rule for the phone lock: phone-free and not in a 15-minute unlock.
    func shields(at date: Date) -> Bool { phase(at: date) != nil && !isPaused(at: date) }
}

/// The phone lock shared by Remember and its device-activity monitor, which runs even when Remember is closed.
enum SleepShieldCore {
    static var appGroup: String {
        Bundle.main.object(forInfoDictionaryKey: "RememberAppGroup") as? String ?? "group.com.example.remember.shared"
    }

    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

    private enum Keys {
        static let allowed = "remember.sleep.allowed"
        static let locking = "remember.sleep.locking"
        static let session = "remember.sleep.session"
    }

    static var session: SleepSession? {
        get { defaults.data(forKey: Keys.session).flatMap { try? JSONDecoder().decode(SleepSession.self, from: $0) } }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) { defaults.set(data, forKey: Keys.session) }
            else { defaults.removeObject(forKey: Keys.session) }
        }
    }

    /// Whether "Lock my phone" is on at all.
    static var isLocking: Bool {
        get { defaults.bool(forKey: Keys.locking) }
        set { defaults.set(newValue, forKey: Keys.locking) }
    }

    /// Apps someone can still open while phone-free.
    static func loadAllowed() -> FamilyActivitySelection {
        guard let data = defaults.data(forKey: Keys.allowed),
              let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) else { return FamilyActivitySelection() }
        return selection
    }

    static func saveAllowed(_ selection: FamilyActivitySelection) {
        if let data = try? PropertyListEncoder().encode(selection) { defaults.set(data, forKey: Keys.allowed) }
    }

    /// Shields or lifts, as the rule says for `date`.
    static func refresh(at date: Date = .now) {
        if isLocking, session?.shields(at: date) == true { shield() } else { lift() }
    }

    /// Shields every app and website except the allowed ones.
    static func shield() {
        let allowed = loadAllowed()
        let store = ManagedSettingsStore(named: .rememberSleep)
        store.shield.applicationCategories = .all(except: allowed.applicationTokens)
        store.shield.webDomainCategories = .all(except: allowed.webDomainTokens)
    }

    static func lift() {
        ManagedSettingsStore(named: .rememberSleep).clearAllSettings()
    }
}
