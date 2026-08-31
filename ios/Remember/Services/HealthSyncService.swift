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

@MainActor
final class HealthSyncService {
    private let store = HKHealthStore()

    func readApprovedMetrics(days: Int = 30) async throws -> [HealthMetricUpload] {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthSyncError.unavailable }
        let quantityDefinitions: [(HKQuantityTypeIdentifier, String, HKUnit)] = [
            (.stepCount, "steps", .count()),
            (.activeEnergyBurned, "active_energy", .kilocalorie()),
            (.appleExerciseTime, "exercise_minutes", .minute()),
            (.bodyMass, "weight", .pound()),
            (.restingHeartRate, "resting_heart_rate", .count().unitDivided(by: .minute())),
            (.heartRateVariabilitySDNN, "heart_rate_variability", .secondUnit(with: .milli)),
            (.dietaryWater, "water", .literUnit(with: .milli)),
        ]
        let quantityTypes = quantityDefinitions.compactMap { HKQuantityType.quantityType(forIdentifier: $0.0) }
        let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
        let mindfulType = HKObjectType.categoryType(forIdentifier: .mindfulSession)
        var readTypes = Set<HKObjectType>(quantityTypes)
        if let sleepType { readTypes.insert(sleepType) }
        if let mindfulType { readTypes.insert(mindfulType) }
        readTypes.insert(HKObjectType.workoutType())
        try await store.requestAuthorization(toShare: [], read: readTypes)

        let start = Calendar.current.date(byAdding: .day, value: -max(1, days), to: .now) ?? .distantPast
        let predicate = HKQuery.predicateForSamples(withStart: start, end: .now, options: .strictStartDate)
        var metrics: [HealthMetricUpload] = []
        for definition in quantityDefinitions {
            guard let type = HKQuantityType.quantityType(forIdentifier: definition.0) else { continue }
            let samples = try await quantitySamples(type: type, predicate: predicate)
            metrics.append(contentsOf: samples.map { sample in
                HealthMetricUpload(
                    externalId: sample.uuid.uuidString,
                    type: definition.1,
                    value: sample.quantity.doubleValue(for: definition.2),
                    unit: unitLabel(for: definition.1),
                    startAt: sample.startDate,
                    endAt: sample.endDate,
                    source: sample.sourceRevision.source.name,
                    metadata: ["bundleIdentifier": sample.sourceRevision.source.bundleIdentifier]
                )
            })
        }
        if let sleepType {
            let samples = try await categorySamples(type: sleepType, predicate: predicate)
            let asleepValues: Set<Int> = [
                HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                HKCategoryValueSleepAnalysis.asleepREM.rawValue,
            ]
            metrics.append(contentsOf: samples.filter { asleepValues.contains($0.value) }.map { sample in
                HealthMetricUpload(
                    externalId: sample.uuid.uuidString, type: "sleep",
                    value: sample.endDate.timeIntervalSince(sample.startDate) / 3_600, unit: "hr",
                    startAt: sample.startDate, endAt: sample.endDate,
                    source: sample.sourceRevision.source.name,
                    metadata: ["stage": String(sample.value)]
                )
            })
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
