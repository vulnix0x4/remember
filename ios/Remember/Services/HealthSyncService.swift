@preconcurrency import HealthKit
import Foundation

enum HealthSyncError: LocalizedError {
    case unavailable
    case accessDenied

    var errorDescription: String? {
        switch self {
        case .unavailable: "Apple Health is unavailable on this device."
        case .accessDenied: "Apple Health access was not granted."
        }
    }
}

struct HealthSleepIntervalSample: Sendable {
    let externalID: String
    let startAt: Date
    let endAt: Date
    let sourceName: String
    let bundleIdentifier: String
    let stage: Int
}

enum HealthMetricAggregation {
    static let statisticsMarker = "healthkit_statistics"
    static let sleepUnionMarker = "healthkit_sleep_union"

    static func cumulativeTotal(
        in metrics: [LifeHealthMetric],
        type: String,
        on date: Date = .now,
        calendar: Calendar = .current
    ) -> Double {
        let dayMetrics = metrics.filter {
            $0.type == type && calendar.isDate($0.startAt, inSameDayAs: date)
        }
        let manualTotal = dayMetrics.lazy.filter { !isHealthKitManaged($0) }.reduce(0) { $0 + $1.value }
        let statistics = dayMetrics
            .filter { $0.metadata["aggregation"] == statisticsMarker }
            .max { $0.createdAt < $1.createdAt }

        if let statistics {
            return max(0, statistics.value) + manualTotal
        }

        let healthKitMetrics = dayMetrics.filter(isHealthKitManaged)
        let totalsBySource = Dictionary(grouping: healthKitMetrics) { sourceKey(for: $0) }
            .values
            .map { samples in samples.reduce(0) { $0 + $1.value } }
        return max(0, totalsBySource.max() ?? 0) + manualTotal
    }

    static func latestSleepHours(
        in metrics: [LifeHealthMetric],
        calendar: Calendar = .current
    ) -> Double? {
        let sleepMetrics = metrics.filter { $0.type == "sleep" }
        guard let latestEnd = sleepMetrics.map(\.endAt).max() else { return nil }
        let latestDay = sleepDay(for: latestEnd, calendar: calendar)
        let dayMetrics = sleepMetrics.filter {
            sleepDay(for: $0.endAt, calendar: calendar) == latestDay
        }
        let manualTotal = dayMetrics.lazy.filter { !isHealthKitManaged($0) }.reduce(0) { $0 + $1.value }
        let unionMetrics = dayMetrics.filter { $0.metadata["aggregation"] == sleepUnionMarker }

        let healthKitHours: Double
        if let latestUnion = unionMetrics.max(by: { $0.createdAt < $1.createdAt }) {
            healthKitHours = max(0, latestUnion.value)
        } else {
            let intervals = dayMetrics
                .filter(isHealthKitManaged)
                .map { DateInterval(start: $0.startAt, end: max($0.startAt, $0.endAt)) }
            healthKitHours = unionDuration(of: intervals) / 3_600
        }

        let total = healthKitHours + manualTotal
        return total > 0 ? total : nil
    }

    static func mergedSleepMetrics(
        from samples: [HealthSleepIntervalSample],
        calendar: Calendar = .current
    ) -> [HealthMetricUpload] {
        Dictionary(grouping: samples.filter { $0.endAt > $0.startAt }) {
            sleepDay(for: $0.endAt, calendar: calendar)
        }
        .map { sleepDay, daySamples in
            let intervals = daySamples.map { DateInterval(start: $0.startAt, end: $0.endAt) }
            let sources = Set(daySamples.map(\.sourceName)).sorted()
            let bundleIdentifiers = Set(daySamples.map(\.bundleIdentifier).filter { !$0.isEmpty }).sorted()
            let sampleExternalIDs = daySamples.map(\.externalID).sorted()
            let stages = Set(daySamples.map { String($0.stage) }).sorted()
            let startAt = intervals.map(\.start).min() ?? sleepDay
            let endAt = intervals.map(\.end).max() ?? startAt
            var metadata = [
                "aggregation": sleepUnionMarker,
                "sampleCount": String(daySamples.count),
                "sampleExternalIDs": sampleExternalIDs.joined(separator: ","),
                "sourceNames": sources.joined(separator: ", "),
                "stages": stages.joined(separator: ","),
            ]
            if !bundleIdentifiers.isEmpty {
                metadata["sourceBundleIdentifiers"] = bundleIdentifiers.joined(separator: ",")
            }
            return HealthMetricUpload(
                externalId: stableExternalID(type: "sleep", day: sleepDay),
                type: "sleep",
                value: unionDuration(of: intervals) / 3_600,
                unit: "hr",
                startAt: startAt,
                endAt: endAt,
                source: "Apple Health",
                metadata: metadata
            )
        }
        .sorted { $0.startAt > $1.startAt }
    }

    static func sleepDay(for date: Date, calendar: Calendar = .current) -> Date {
        calendar.startOfDay(for: calendar.date(byAdding: .hour, value: -12, to: date) ?? date)
    }

    static func stableExternalID(type: String, day: Date) -> String {
        "healthkit.\(type).\(Int64(day.timeIntervalSince1970))"
    }

    private static func isHealthKitManaged(_ metric: LifeHealthMetric) -> Bool {
        metric.metadata["aggregation"] == statisticsMarker
            || metric.metadata["aggregation"] == sleepUnionMarker
            || metric.metadata["bundleIdentifier"] != nil
            || metric.metadata["stage"] != nil
    }

    private static func sourceKey(for metric: LifeHealthMetric) -> String {
        metric.metadata["bundleIdentifier"] ?? metric.source
    }

    private static func unionDuration(of intervals: [DateInterval]) -> TimeInterval {
        let sorted = intervals
            .filter { $0.duration > 0 }
            .sorted { lhs, rhs in
                lhs.start == rhs.start ? lhs.end < rhs.end : lhs.start < rhs.start
            }
        guard var current = sorted.first else { return 0 }
        var total: TimeInterval = 0

        for interval in sorted.dropFirst() {
            if interval.start <= current.end {
                current = DateInterval(start: current.start, end: max(current.end, interval.end))
            } else {
                total += current.duration
                current = interval
            }
        }
        return total + current.duration
    }
}

@MainActor
final class HealthSyncService {
    private struct QuantityDefinition {
        let identifier: HKQuantityTypeIdentifier
        let metricType: String
        let unit: HKUnit
        let isCumulative: Bool
    }

    private let store = HKHealthStore()

    func readApprovedMetrics(days: Int = 30) async throws -> [HealthMetricUpload] {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthSyncError.unavailable }
        let quantityDefinitions = [
            QuantityDefinition(identifier: .stepCount, metricType: "steps", unit: .count(), isCumulative: true),
            QuantityDefinition(identifier: .activeEnergyBurned, metricType: "active_energy", unit: .kilocalorie(), isCumulative: true),
            QuantityDefinition(identifier: .appleExerciseTime, metricType: "exercise_minutes", unit: .minute(), isCumulative: true),
            QuantityDefinition(identifier: .bodyMass, metricType: "weight", unit: .pound(), isCumulative: false),
            QuantityDefinition(identifier: .restingHeartRate, metricType: "resting_heart_rate", unit: .count().unitDivided(by: .minute()), isCumulative: false),
            QuantityDefinition(identifier: .heartRateVariabilitySDNN, metricType: "heart_rate_variability", unit: .secondUnit(with: .milli), isCumulative: false),
            QuantityDefinition(identifier: .dietaryWater, metricType: "water", unit: .literUnit(with: .milli), isCumulative: false),
        ]
        let resolvedQuantityDefinitions = quantityDefinitions.compactMap { definition in
            HKQuantityType.quantityType(forIdentifier: definition.identifier).map { (definition, $0) }
        }
        let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
        let mindfulType = HKObjectType.categoryType(forIdentifier: .mindfulSession)
        var readTypes = Set<HKObjectType>(resolvedQuantityDefinitions.map(\.1))
        if let sleepType { readTypes.insert(sleepType) }
        if let mindfulType { readTypes.insert(mindfulType) }
        readTypes.insert(HKObjectType.workoutType())
        try await store.requestAuthorization(toShare: [], read: readTypes)

        let end = Date.now
        let start = Calendar.current.date(byAdding: .day, value: -max(1, days), to: end) ?? .distantPast
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        var metrics: [HealthMetricUpload] = []

        for (definition, type) in resolvedQuantityDefinitions {
            if definition.isCumulative {
                metrics.append(contentsOf: try await cumulativeMetrics(
                    type: type,
                    metricType: definition.metricType,
                    unit: definition.unit,
                    predicate: predicate,
                    start: start,
                    end: end
                ))
            } else {
                let samples = try await quantitySamples(type: type, predicate: predicate)
                metrics.append(contentsOf: samples.map { sample in
                    HealthMetricUpload(
                        externalId: sample.uuid.uuidString,
                        type: definition.metricType,
                        value: sample.quantity.doubleValue(for: definition.unit),
                        unit: unitLabel(for: definition.metricType),
                        startAt: sample.startDate,
                        endAt: sample.endDate,
                        source: sample.sourceRevision.source.name,
                        metadata: ["bundleIdentifier": sample.sourceRevision.source.bundleIdentifier]
                    )
                })
            }
        }

        if let sleepType {
            let samples = try await categorySamples(type: sleepType, predicate: predicate)
            let asleepValues: Set<Int> = [
                HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                HKCategoryValueSleepAnalysis.asleepREM.rawValue,
            ]
            let intervals = samples.filter { asleepValues.contains($0.value) }.map { sample in
                HealthSleepIntervalSample(
                    externalID: sample.uuid.uuidString,
                    startAt: sample.startDate,
                    endAt: sample.endDate,
                    sourceName: sample.sourceRevision.source.name,
                    bundleIdentifier: sample.sourceRevision.source.bundleIdentifier,
                    stage: sample.value
                )
            }
            metrics.append(contentsOf: HealthMetricAggregation.mergedSleepMetrics(from: intervals))
        }

        if let mindfulType {
            let samples = try await categorySamples(type: mindfulType, predicate: predicate)
            metrics.append(contentsOf: samples.map { sample in
                HealthMetricUpload(
                    externalId: sample.uuid.uuidString, type: "mindful_minutes",
                    value: sample.endDate.timeIntervalSince(sample.startDate) / 60, unit: "min",
                    startAt: sample.startDate, endAt: sample.endDate,
                    source: sample.sourceRevision.source.name, metadata: [:]
                )
            })
        }
        let workouts = try await workoutSamples(predicate: predicate)
        metrics.append(contentsOf: workouts.map { workout in
            HealthMetricUpload(
                externalId: workout.uuid.uuidString, type: "workout", value: workout.duration / 60, unit: "min",
                startAt: workout.startDate, endAt: workout.endDate, source: workout.sourceRevision.source.name,
                metadata: ["activityType": String(workout.workoutActivityType.rawValue)]
            )
        })
        return metrics
    }

    private func cumulativeMetrics(
        type: HKQuantityType,
        metricType: String,
        unit: HKUnit,
        predicate: NSPredicate,
        start: Date,
        end: Date
    ) async throws -> [HealthMetricUpload] {
        let samplePredicate = HKSamplePredicate.quantitySample(type: type, predicate: predicate)
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: samplePredicate,
            options: .cumulativeSum,
            anchorDate: Calendar.current.startOfDay(for: start),
            intervalComponents: DateComponents(day: 1)
        )
        let collection = try await query.result(for: store)
        let sourceQuery = HKSourceQueryDescriptor(predicate: samplePredicate)
        let sources = try await sourceQuery.result(for: store)
        let sourceNames = Set(sources.map(\.name)).sorted()
        let bundleIdentifiers = Set(sources.map(\.bundleIdentifier)).sorted()

        return collection.statistics().compactMap { statistics in
            guard statistics.endDate > start,
                  statistics.startDate < end,
                  let quantity = statistics.sumQuantity() else { return nil }
            let value = quantity.doubleValue(for: unit)
            guard value > 0 else { return nil }
            var metadata = [
                "aggregation": HealthMetricAggregation.statisticsMarker,
                "sourceNames": sourceNames.joined(separator: ", "),
            ]
            if !bundleIdentifiers.isEmpty {
                metadata["sourceBundleIdentifiers"] = bundleIdentifiers.joined(separator: ",")
            }
            return HealthMetricUpload(
                externalId: HealthMetricAggregation.stableExternalID(type: metricType, day: statistics.startDate),
                type: metricType,
                value: value,
                unit: unitLabel(for: metricType),
                startAt: statistics.startDate,
                endAt: min(statistics.endDate, end),
                source: "Apple Health",
                metadata: metadata
            )
        }
    }

    private func quantitySamples(type: HKQuantityType, predicate: NSPredicate) async throws -> [HKQuantitySample] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: samples as? [HKQuantitySample] ?? []) }
            }
            store.execute(query)
        }
    }

    private func categorySamples(type: HKCategoryType, predicate: NSPredicate) async throws -> [HKCategorySample] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: samples as? [HKCategorySample] ?? []) }
            }
            store.execute(query)
        }
    }

    private func workoutSamples(predicate: NSPredicate) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: samples as? [HKWorkout] ?? []) }
            }
            store.execute(query)
        }
    }

    private func unitLabel(for type: String) -> String {
        switch type {
        case "steps": "count"
        case "active_energy": "kcal"
        case "exercise_minutes": "min"
        case "weight": "lb"
        case "resting_heart_rate": "bpm"
        case "heart_rate_variability": "ms"
        case "water": "mL"
        default: "count"
        }
    }
}
