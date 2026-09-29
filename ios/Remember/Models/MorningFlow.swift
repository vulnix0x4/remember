import Foundation

/// Where someone is in today's morning flow. Stored on the device; one per day.
struct MorningSession: Codable, Equatable, Sendable {
    enum Stage: String, Codable, Sendable { case warmup, big, done }

    /// Local calendar day, "YYYY-MM-DD". A session only counts on its own day.
    var day: String
    /// Nil when the person chose "Not today".
    var startedAt: Date?
    var bigTaskID: UUID?
    var stage: Stage
}

/// Morning flow: a short warm-up of quick tasks, then ten minutes on the big one, then free choice.
/// Easy wins get the engine going; the cap keeps small tasks from eating the whole day.
enum MorningFlow {
    static let warmupCount = 3
    static let warmupMinutes = 20
    static let bigMinutes = 10
    /// Quick tasks are this long or shorter.
    static let smallMaxMinutes = 15
    /// Big tasks are at least this long.
    static let bigMinMinutes = 30

    struct Candidates: Equatable {
        var small: [LifeTask]
        var big: LifeTask?
    }

    struct Pick: Equatable {
        var task: LifeTask
        var label: String
        var stage: MorningSession.Stage
    }

    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Morning is from two hours before your day starts until four hours after.
    static func isMorning(_ date: Date, startHour: Int = 8, calendar: Calendar = .current) -> Bool {
        let hour = calendar.component(.hour, from: date)
        let from = (startHour - 2 + 24) % 24
        return (hour - from + 24) % 24 < 6
    }

    /// Picks the warm-up and the big one from tasks that can be done now, kept in Jev's order.
    /// Guided routines (laundry) are left out; they run alongside everything else.
    static func candidates(available: [LifeTask], commitments: [Commitment]) -> Candidates {
        let routines = Set(commitments.filter { !$0.steps.isEmpty }.map(\.id))
        let open = available.filter { task in
            (task.status == .queued || task.status == .inbox) && !(task.commitmentId.map(routines.contains) ?? false)
        }
        let big = open.filter { $0.durationMinutes >= bigMinMinutes }.reduce(nil as LifeTask?) { best, task in
            guard let best else { return task }
            return rank(task.priority) > rank(best.priority) ? task : best
        }
        let small = open.filter { $0.id != big?.id && $0.durationMinutes <= smallMaxMinutes }
        return Candidates(small: small, big: big)
    }

    static func shouldOffer(_ session: MorningSession?, candidates: Candidates, now: Date, startHour: Int = 8, hasActive: Bool = false, calendar: Calendar = .current) -> Bool {
        guard !hasActive, session?.day != dayKey(now, calendar: calendar), isMorning(now, startHour: startHour, calendar: calendar) else { return false }
        return candidates.big != nil || candidates.small.count >= 2
    }

    static func start(_ candidates: Candidates, now: Date, calendar: Calendar = .current) -> MorningSession {
        MorningSession(
            day: dayKey(now, calendar: calendar),
            startedAt: now,
            bigTaskID: candidates.big?.id,
            stage: !candidates.small.isEmpty ? .warmup : candidates.big != nil ? .big : .done
        )
    }

    static func skip(now: Date, calendar: Calendar = .current) -> MorningSession {
        MorningSession(day: dayKey(now, calendar: calendar), startedAt: nil, bigTaskID: nil, stage: .done)
    }

    /// Warm-up tasks finished since the morning started (the big one doesn't count).
    static func warmupDone(_ session: MorningSession, tasks: [LifeTask]) -> Int {
        guard let startedAt = session.startedAt else { return 0 }
        return tasks.count { $0.status == .done && $0.id != session.bigTaskID && ($0.completedAt.map { $0 >= startedAt } ?? false) }
    }

    /// Where the morning is now. The warm-up ends after three quick wins or twenty minutes, whichever
    /// comes first, but never interrupts a task in progress: the switch shows on the next pick.
    static func stage(_ session: MorningSession?, tasks: [LifeTask], small: [LifeTask], now: Date, calendar: Calendar = .current) -> MorningSession.Stage? {
        guard let session, session.day == dayKey(now, calendar: calendar), let startedAt = session.startedAt else { return nil }
        var stage = session.stage
        if stage == .warmup {
            let over = warmupDone(session, tasks: tasks) >= warmupCount
                || now.timeIntervalSince(startedAt) >= TimeInterval(warmupMinutes * 60)
                || small.isEmpty
            if over { stage = .big }
        }
        if stage == .big {
            let big = tasks.first { $0.id == session.bigTaskID }
            let open = big.map { [.queued, .inbox, .active].contains($0.status) && ($0.notBefore ?? .distantPast) <= now } ?? false
            if !open { stage = .done }
        }
        return stage
    }

    /// What the Now card offers during the morning, or nil to let Jev choose as usual.
    static func pick(_ session: MorningSession?, tasks: [LifeTask], small: [LifeTask], now: Date, calendar: Calendar = .current) -> Pick? {
        guard let session, let stage = stage(session, tasks: tasks, small: small, now: now, calendar: calendar) else { return nil }
        switch stage {
        case .warmup:
            guard let first = small.first else { return nil }
            let number = min(warmupDone(session, tasks: tasks) + 1, warmupCount)
            return Pick(task: first, label: "WARM-UP · \(number) OF \(warmupCount)", stage: .warmup)
        case .big:
            guard let big = tasks.first(where: { $0.id == session.bigTaskID }) else { return nil }
            return Pick(task: big, label: "THE BIG ONE", stage: .big)
        case .done:
            return nil
        }
    }

    /// True while this task is the big one and should get a ten-minute start instead of its full length.
    static func isBigStart(_ session: MorningSession?, taskID: UUID, now: Date, calendar: Calendar = .current) -> Bool {
        guard let session else { return false }
        return session.day == dayKey(now, calendar: calendar) && session.startedAt != nil && session.stage != .done && session.bigTaskID == taskID
    }

    private static func rank(_ priority: LifeTaskPriority) -> Int {
        switch priority {
        case .must: 3
        case .high: 2
        case .normal: 1
        case .low: 0
        }
    }

    // MARK: Stored on this device

    private static let key = "remember.morning"

    static func load(_ defaults: UserDefaults = .standard) -> MorningSession? {
        defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(MorningSession.self, from: $0) }
    }

    static func save(_ session: MorningSession?, _ defaults: UserDefaults = .standard) {
        if let session, let data = try? JSONEncoder().encode(session) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
