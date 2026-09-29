import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import Observation

/// Tonight's phone-free night, from Going to bed to I'm up: the session (shared with the device-activity
/// monitor through the app group), the Screen Time lock, the 15-minute unlock, and tonight's checklist.
@Observable @MainActor
final class SleepGuard {
    /// The last sleep settings this device saw from Jev, so the night works offline too.
    private(set) var settings: SleepSettings
    private(set) var isAuthorized: Bool
    /// The latest night: running, or finished and waiting for its check-in.
    private(set) var session: SleepSession? {
        didSet { SleepShieldCore.session = session }
    }
    /// "Lock my phone": block apps with Screen Time while phone-free.
    var isLocking: Bool {
        didSet {
            defaults.set(isLocking, forKey: Keys.locking)
            SleepShieldCore.isLocking = isLocking
            syncLock()
        }
    }
    var allowed: FamilyActivitySelection {
        didSet { SleepShieldCore.saveAllowed(allowed); syncLock() }
    }
    /// Checklist items ticked tonight. Resets with each Going to bed.
    private(set) var checked: Set<String>

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        settings = defaults.data(forKey: Keys.settings).flatMap { try? JSONDecoder().decode(SleepSettings.self, from: $0) } ?? SleepSettings()
        isAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
        isLocking = defaults.bool(forKey: Keys.locking)
        allowed = SleepShieldCore.loadAllowed()
        session = SleepShieldCore.session
        checked = Set(defaults.stringArray(forKey: Keys.checked) ?? [])
        #if DEBUG
        // Preview data only: REMEMBER_MOCK_SLEEP_SESSION="bed:-30" went to bed 30 minutes ago, "up:-10" got up 10 minutes ago.
        if AppConfiguration.usesMockFallback, let value = ProcessInfo.processInfo.environment["REMEMBER_MOCK_SLEEP_SESSION"] {
            let parts = value.split(separator: ":")
            if parts.count == 2, let minutes = Double(parts[1]) {
                let at = Date.now.addingTimeInterval(minutes * 60)
                session = parts[0] == "up"
                    ? SleepSession(bedAt: at.addingTimeInterval(-8 * 3600), upAt: at, morningMinutes: 60)
                    : SleepSession(bedAt: at, morningMinutes: 60)
            }
        }
        #endif
    }

    var allowedSummary: String {
        let apps = allowed.applicationTokens.count, categories = allowed.categoryTokens.count
        if apps == 0 && categories == 0 { return "None" }
        var parts: [String] = []
        if categories > 0 { parts.append(categories == 1 ? "1 category" : "\(categories) categories") }
        if apps > 0 { parts.append(apps == 1 ? "1 app" : "\(apps) apps") }
        return parts.joined(separator: ", ")
    }

    /// Takes new settings from Jev. Turning phone-free nights off ends tonight's.
    func update(_ sleep: SleepSettings) {
        guard sleep != settings else { return }
        settings = sleep
        if let data = try? JSONEncoder().encode(sleep) { defaults.set(data, forKey: Keys.settings) }
        if !sleep.enabled, session?.phase(at: .now) != nil {
            session = nil
            syncLock()
        }
    }

    /// Tonight's session and phase while phone-free, unless someone unlocked for a moment.
    func phoneFree(at date: Date) -> (session: SleepSession, phase: SleepSession.Phase)? {
        guard let session, let phase = session.phase(at: date), !session.isPaused(at: date) else { return nil }
        return (session, phase)
    }

    var isNight: Bool { session?.phase(at: .now) != nil }

    @discardableResult
    func requestAuthorization() async -> Bool {
        do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual) } catch { }
        isAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
        return isAuthorized
    }

    // MARK: The two taps

    /// "Going to bed": phone-free starts now. Returns what Undo needs.
    @discardableResult
    func goToBed(now: Date = .now) -> SleepSession? {
        let previous = session
        session = SleepSession(bedAt: now, morningMinutes: settings.morningMinutes)
        checked = []
        defaults.set([String](), forKey: Keys.checked)
        syncLock(now: now)
        return previous
    }

    /// Undo for Going to bed.
    func restore(_ previous: SleepSession?) {
        session = previous
        syncLock()
    }

    /// "I'm up": the night is over and the phone-free morning starts. Returns the night to save.
    func wakeUp(now: Date = .now) -> SleepSession? {
        guard var night = session, night.upAt == nil, night.phase(at: now) != nil else { return nil }
        night.upAt = now
        night.pausedUntil = nil
        session = night
        syncLock(now: now)
        return night
    }

    /// Undo for I'm up: back to sleep time.
    func undoWakeUp() {
        guard var night = session else { return }
        night.upAt = nil
        session = night
        syncLock()
    }

    /// "Unlock for 15 minutes": lifts the lock now; it comes back by itself.
    func pause(minutes: Int = 15, now: Date = .now) {
        guard var night = session else { return }
        let ends = now.addingTimeInterval(TimeInterval(minutes * 60))
        night.pausedUntil = ends
        night.unlocks += 1
        session = night
        SleepShieldCore.refresh(at: now)
        startInterval(.rememberSleepPause, from: now, to: ends)
    }

    func isChecked(_ item: String) -> Bool { checked.contains(item) }

    func toggle(_ item: String) {
        if checked.contains(item) { checked.remove(item) } else { checked.insert(item) }
        defaults.set(Array(checked), forKey: Keys.checked)
    }

    func check(_ item: String) {
        if !checked.contains(item) { toggle(item) }
    }

    // MARK: Screen Time

    /// Keeps the monitor's intervals and the shield in step with tonight: one to the 14-hour cap while
    /// asleep, one to the end of the phone-free morning after I'm up. The shield follows one rule, in
    /// `SleepShieldCore`, wherever it's applied.
    func syncLock(now: Date = .now) {
        let center = DeviceActivityCenter()
        guard isLocking, isAuthorized, let session, session.phase(at: now) != nil else {
            center.stopMonitoring([.rememberSleep, .rememberSleepMorning, .rememberSleepPause])
            SleepShieldCore.lift()
            return
        }
        if session.upAt == nil {
            startInterval(.rememberSleep, from: now, to: session.cap)
        } else {
            // Screen Time intervals are at least 15 minutes; the rule lifts the shield on time regardless.
            startInterval(.rememberSleepMorning, from: now, to: max(session.ends, now.addingTimeInterval(15 * 60)))
        }
        SleepShieldCore.refresh(at: now)
    }

    private func startInterval(_ name: DeviceActivityName, from start: Date, to end: Date) {
        guard isLocking, isAuthorized else { return }
        let calendar = Calendar.current
        let components: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents(components, from: start),
            intervalEnd: calendar.dateComponents(components, from: max(end, start.addingTimeInterval(15 * 60))),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([name])
        try? center.startMonitoring(name, during: schedule)
    }

    private enum Keys {
        static let settings = "remember.sleep.settings"
        static let locking = "remember.sleep.locking"
        static let checked = "remember.sleep.checked"
    }
}
