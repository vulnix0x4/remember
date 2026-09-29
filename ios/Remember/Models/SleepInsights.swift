import Foundation

/// One night, merged from Apple Health and the night Remember saved from the two taps.
struct SleepNight: Identifiable, Equatable, Sendable {
    /// The date of getting up minus 12 hours, "YYYY-MM-DD".
    var key: String
    var fellAsleep: Date
    var gotUp: Date
    var hours: Double
    /// When Going to bed was tapped, for nights Remember saved.
    var bedAt: Date?
    var rating: SleepRating?
    /// Minutes from Going to bed to falling asleep, from the check-in.
    var latencyMinutes: Int?
    var fromHealth: Bool

    var id: String { key }
}

enum SleepRating: String, CaseIterable, Sendable {
    case rough, okay, great

    var label: String {
        switch self {
        case .rough: "Rough"
        case .okay: "Okay"
        case .great: "Great"
        }
    }
}

/// "How long until you fell asleep?", in minutes after Going to bed.
enum SleepLatency: Int, CaseIterable, Sendable {
    case quick = 15, hour = 60, hourAndHalf = 90, long = 150

    var label: String {
        switch self {
        case .quick: "Under 30 min"
        case .hour: "About an hour"
        case .hourAndHalf: "1–2 hr"
        case .long: "2+ hr"
        }
    }
}

enum SleepInsights {
    static let source = "Remember"
    static let nightMarker = "remember_night"
    private static let nightPrefix = "remember.night."

    static func nightKey(for gotUp: Date, calendar: Calendar = .current) -> String {
        MorningFlow.dayKey(gotUp.addingTimeInterval(-12 * 3600), calendar: calendar)
    }

    static func nightID(_ key: String) -> String { nightPrefix + key }

    static func isSavedNight(_ metric: LifeHealthMetric) -> Bool {
        metric.type == "sleep" && metric.metadata["aggregation"] == nightMarker
    }

    static func isHealthNight(_ metric: LifeHealthMetric) -> Bool {
        metric.type == "sleep" && metric.metadata["aggregation"] == HealthMetricAggregation.sleepUnionMarker
    }

    /// Nights, newest first. Apple Health gives the times; a saved night gives the rating, the time to
    /// fall asleep and when Going to bed was tapped, and the times when Health has nothing for that night.
    static func nights(from metrics: [LifeHealthMetric], calendar: Calendar = .current) -> [SleepNight] {
        var byKey: [String: SleepNight] = [:]
        let sleep = metrics.filter { $0.type == "sleep" && $0.endAt > $0.startAt }
        for metric in sleep.filter(isHealthNight).sorted(by: { $0.createdAt < $1.createdAt }) {
            let key = nightKey(for: metric.endAt, calendar: calendar)
            byKey[key] = SleepNight(key: key, fellAsleep: metric.startAt, gotUp: metric.endAt, hours: metric.value, fromHealth: true)
        }
        for metric in sleep.filter(isSavedNight).sorted(by: { $0.createdAt < $1.createdAt }) {
            // A saved night names its night, so a late get-up after noon never moves it.
            let named = metric.externalId.flatMap { $0.hasPrefix(nightPrefix) ? String($0.dropFirst(nightPrefix.count)) : nil }
            let key = named ?? nightKey(for: metric.endAt, calendar: calendar)
            let bedAt = metric.metadata["bedAt"].flatMap { try? Date($0, strategy: .iso8601) }
            let rating = metric.metadata["rating"].flatMap(SleepRating.init(rawValue:))
            let latency = metric.metadata["latency"].flatMap { Int($0) }
            if var night = byKey[key], night.fromHealth {
                night.bedAt = bedAt
                night.rating = rating
                night.latencyMinutes = latency
                byKey[key] = night
            } else {
                byKey[key] = SleepNight(key: key, fellAsleep: metric.startAt, gotUp: metric.endAt, hours: metric.value,
                                        bedAt: bedAt, rating: rating, latencyMinutes: latency, fromHealth: false)
            }
        }
        return byKey.values.sorted { $0.key > $1.key }
    }

    /// The newest 7 nights keyed 0 to 7 days before `today`. Today counts: a night owl who got up after
    /// noon has a night keyed today.
    static func lastWeek(_ nights: [SleepNight], today: String) -> [SleepNight] {
        Array(nights.filter { night in
            let days = daysBetween(night.key, today)
            return days >= 0 && days <= 7
        }.sorted { $0.key > $1.key }.prefix(7))
    }

    static func week(_ nights: [SleepNight], calendar: Calendar = .current) -> SleepWeekNumbers {
        // When they went to bed: the tap, or where Apple Health saw sleep start.
        let bedtimes = nights.map { SleepMath.afterEvening($0.bedAt ?? $0.fellAsleep, calendar: calendar) }
        let wakes = nights.map { SleepMath.afterEvening($0.gotUp, calendar: calendar) }
        let latencies = nights.compactMap(\.latencyMinutes)
        return SleepWeekNumbers(
            nights: nights.count,
            averageHours: nights.isEmpty ? nil : nights.map(\.hours).reduce(0, +) / Double(nights.count),
            usualBedtime: SleepMath.median(bedtimes),
            bedtimeRangeMinutes: bedtimes.isEmpty ? nil : (bedtimes.max() ?? 0) - (bedtimes.min() ?? 0),
            wakeRangeMinutes: wakes.isEmpty ? nil : (wakes.max() ?? 0) - (wakes.min() ?? 0),
            averageLatencyMinutes: latencies.isEmpty ? nil : latencies.reduce(0, +) / latencies.count,
            latencyAnswers: latencies.count,
            usualWake: SleepMath.median(wakes)
        )
    }

    // MARK: The saved night and the morning check-in

    /// The night from the two taps, optionally with the check-in's answers.
    static func savedNight(_ session: SleepSession, rating: SleepRating? = nil, latency: SleepLatency? = nil, calendar: Calendar = .current) -> HealthMetricUpload? {
        guard let upAt = session.upAt, upAt > session.bedAt else { return nil }
        let asleep = min(session.bedAt.addingTimeInterval(TimeInterval((latency?.rawValue ?? 0) * 60)), upAt)
        var metadata = ["aggregation": nightMarker, "bedAt": session.bedAt.formatted(.iso8601)]
        metadata["rating"] = rating?.rawValue
        metadata["latency"] = latency.map { String($0.rawValue) }
        return HealthMetricUpload(
            externalId: nightID(nightKey(for: upAt, calendar: calendar)),
            type: "sleep",
            value: upAt.timeIntervalSince(asleep) / 3600,
            unit: "hr",
            startAt: asleep,
            endAt: upAt,
            source: source,
            metadata: metadata
        )
    }

    /// Last night's session while its check-in is open: for 8 hours after I'm up, until it has a rating.
    static func dueCheckIn(_ session: SleepSession?, metrics: [LifeHealthMetric], at date: Date, calendar: Calendar = .current) -> SleepSession? {
        guard let session, let upAt = session.upAt, date >= upAt, date < upAt.addingTimeInterval(8 * 3600) else { return nil }
        let id = nightID(nightKey(for: upAt, calendar: calendar))
        let answered = metrics.contains { $0.externalId == id && isSavedNight($0) && $0.metadata["rating"] != nil }
        return answered ? nil : session
    }

    /// Apple Health's record of that night, when there is one.
    static func healthNight(for session: SleepSession, metrics: [LifeHealthMetric], calendar: Calendar = .current) -> LifeHealthMetric? {
        guard let upAt = session.upAt else { return nil }
        let key = nightKey(for: upAt, calendar: calendar)
        return metrics.filter(isHealthNight).last { nightKey(for: $0.endAt, calendar: calendar) == key }
    }

    static func daysBetween(_ from: String, _ to: String) -> Int {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        func day(_ key: String) -> Date? {
            let parts = key.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return nil }
            return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
        }
        guard let start = day(from), let end = day(to) else { return 0 }
        return Int((end.timeIntervalSince(start) / 86_400).rounded())
    }
}
