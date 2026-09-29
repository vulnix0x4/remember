import Foundation
import Observation
import UserNotifications

/// Gentle local notifications: the next planned thing, "wrap up in 5 minutes", and routine waits ending,
/// each sent once and never repeated. Sleep adds one daily nudge: last call for caffeine.
@Observable @MainActor
final class Nudges {
    var isEnabled: Bool { didSet { defaults.set(isEnabled, forKey: Keys.enabled) } }
    private(set) var isAuthorized = false

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let center = UNUserNotificationCenter.current()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        isEnabled = defaults.object(forKey: Keys.enabled) as? Bool ?? false
        Task { await refreshAuthorization() }
    }

    func refreshAuthorization() async {
        let settings = await center.notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
    }

    /// Turns nudges on, asking for permission the first time. Returns whether nudges are on.
    @discardableResult
    func enable() async -> Bool {
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        isAuthorized = granted
        isEnabled = granted
        return granted
    }

    func disable() {
        isEnabled = false
        center.removeAllPendingNotificationRequests()
    }

    /// "Washer's done. Move clothes to the dryer."
    func routineWaitEnds(taskID: UUID, at date: Date, finished: String, next: String?) {
        schedule(id: "remember.wait.\(taskID)", at: date, title: "\(finished) is done", body: next.map { "Next: \($0)" } ?? "Tap to keep going.")
    }

    func wrapUp(taskID: UUID, title: String, at date: Date) {
        schedule(id: "remember.wrapup.\(taskID)", at: date, title: "Wrap up in 5 minutes", body: title)
    }

    /// Keeps exactly one pending nudge for the next planned block.
    func nextPlanned(title: String, at date: Date) {
        schedule(id: "remember.next", at: date, title: "Time for \(title)", body: "Open Remember when you're ready to start.")
    }

    func cancel(taskID: UUID) {
        center.removePendingNotificationRequests(withIdentifiers: ["remember.wait.\(taskID)", "remember.wrapup.\(taskID)"])
    }

    /// The daily caffeine nudge, replaced whenever the usual bedtime moves. Nil turns it off.
    func sleepReminders(caffeine: DateComponents?) {
        center.removePendingNotificationRequests(withIdentifiers: [Keys.caffeine])
        guard isEnabled, isAuthorized else { return }
        if let caffeine {
            daily(id: Keys.caffeine, at: caffeine, title: "Last call for caffeine", body: "Caffeine after now can keep you up tonight.")
        }
    }

    func cancelNextPlanned() {
        center.removePendingNotificationRequests(withIdentifiers: ["remember.next"])
    }

    private func schedule(id: String, at date: Date, title: String, body: String) {
        guard isEnabled, isAuthorized, date > .now.addingTimeInterval(5) else { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: date.timeIntervalSinceNow, repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    private func daily(id: String, at time: DateComponents, title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: time.hour, minute: time.minute), repeats: true)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    private enum Keys {
        static let enabled = "remember.nudges.enabled"
        static let caffeine = "remember.sleep.caffeine"
    }
}
