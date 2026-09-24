import DeviceActivity
import ManagedSettings

/// Lifts the focus shield when a lock-in block's time is up, even if Remember isn't running.
final class FocusMonitor: DeviceActivityMonitor {
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        ManagedSettingsStore(named: ManagedSettingsStore.Name("remember.focus")).clearAllSettings()
    }
}
