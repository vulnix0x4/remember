import Foundation
import Observation

/// One focus timer shared by Today and Plan. Survives relaunches.
@Observable @MainActor
final class FocusTimer {
    private(set) var taskID: UUID?
    private(set) var startedAt: Date?
    private(set) var accumulated: TimeInterval = 0

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        taskID = defaults.string(forKey: Keys.task).flatMap(UUID.init(uuidString:))
        let started = defaults.double(forKey: Keys.started)
        startedAt = started > 0 ? Date(timeIntervalSince1970: started) : nil
        accumulated = defaults.double(forKey: Keys.accumulated)
    }

    var isRunning: Bool { startedAt != nil }

    func isTracking(_ id: UUID) -> Bool { taskID == id }

    func elapsed(for id: UUID, at date: Date = .now) -> TimeInterval {
        guard taskID == id else { return 0 }
        return accumulated + (startedAt.map { date.timeIntervalSince($0) } ?? 0)
    }

    func minutesSpent(on id: UUID) -> Int {
        max(0, Int((elapsed(for: id) / 60).rounded()))
    }

    func start(_ id: UUID) {
        if taskID != id { reset() }
        taskID = id
        if startedAt == nil { startedAt = .now }
        persist()
    }

    func toggle(_ id: UUID) {
        if taskID == id, let startedAt {
            accumulated += Date.now.timeIntervalSince(startedAt)
            self.startedAt = nil
            persist()
        } else {
            start(id)
        }
    }

    func reset() {
        taskID = nil
        startedAt = nil
        accumulated = 0
        persist()
    }

    private func persist() {
        defaults.set(taskID?.uuidString, forKey: Keys.task)
        defaults.set(startedAt?.timeIntervalSince1970 ?? 0, forKey: Keys.started)
        defaults.set(accumulated, forKey: Keys.accumulated)
    }

    private enum Keys {
        static let task = "remember.focus.task"
        static let started = "remember.focus.started"
        static let accumulated = "remember.focus.accumulated"
    }
}

extension TimeInterval {
    var clockLabel: String {
        let total = max(0, Int(self))
        let hours = total / 3600, minutes = (total % 3600) / 60, seconds = total % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
            : String(format: "%02d:%02d", minutes, seconds)
    }

    var spokenElapsed: String {
        Duration.seconds(max(0, self)).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .wide))
    }
}
