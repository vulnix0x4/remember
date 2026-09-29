import DeviceActivity
import Foundation
import ManagedSettings

/// Lifts the focus shield when a lock-in block's time is up, and keeps the phone-free night locked,
/// even if Remember isn't running.
final class FocusMonitor: DeviceActivityMonitor {
    private let sleepActivities: Set<DeviceActivityName> = [.rememberSleep, .rememberSleepMorning, .rememberSleepPause]

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        if sleepActivities.contains(activity) { SleepShieldCore.refresh(at: .now.addingTimeInterval(5)) }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if sleepActivities.contains(activity) {
            // A few seconds ahead, so an event that fires a moment early still lands on the right side of its boundary.
            SleepShieldCore.refresh(at: .now.addingTimeInterval(5))
        } else {
            ManagedSettingsStore(named: ManagedSettingsStore.Name("remember.focus")).clearAllSettings()
        }
    }
}
