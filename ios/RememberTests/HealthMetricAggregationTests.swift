import Foundation
import Testing
@testable import Remember

struct HealthMetricAggregationTests {
    @Test func authoritativeStatisticsReplaceLegacyRawRowsAndKeepManualData() throws {
        let day = try date("2026-08-31T12:00:00Z")
        let earlier = try date("2026-08-31T12:01:00Z")
        let latest = try date("2026-08-31T12:02:00Z")
        let fixtures: [(type: String, watch: Double, phone: Double, authoritative: Double)] = [
            ("steps", 1_889, 1_057, 2_400),
            ("active_energy", 9_598, 1_200, 6_150),
            ("exercise_minutes", 729, 5_184, 82),
        ]

        for fixture in fixtures {
            let metrics = [
                metric(type: fixture.type, value: fixture.watch, at: day, source: "Apple Watch", metadata: ["bundleIdentifier": "com.apple.health.watch"]),
                metric(type: fixture.type, value: fixture.phone, at: day, source: "iPhone", metadata: ["bundleIdentifier": "com.apple.health.phone"]),
                metric(type: fixture.type, value: fixture.authoritative + 1_000, at: day, source: "Apple Health", metadata: ["aggregation": HealthMetricAggregation.statisticsMarker], createdAt: earlier),
                metric(type: fixture.type, value: fixture.authoritative, at: day, source: "Apple Health", metadata: ["aggregation": HealthMetricAggregation.statisticsMarker], createdAt: latest),
                metric(type: fixture.type, value: 5, at: day, source: "manual", metadata: [:]),
            ]

            #expect(
                HealthMetricAggregation.cumulativeTotal(in: metrics, type: fixture.type, on: day, calendar: utcCalendar)
                    == fixture.authoritative + 5
            )
        }
    }

    @Test func legacyCumulativeFallbackDoesNotAddOverlappingSources() throws {
        let day = try date("2026-08-31T12:00:00Z")
        let metrics = [
            metric(type: "steps", value: 1_889, at: day, source: "Apple Watch", metadata: ["bundleIdentifier": "watch"]),
            metric(type: "steps", value: 1_057, at: day, source: "iPhone", metadata: ["bundleIdentifier": "phone"]),
            metric(type: "steps", value: 40, at: day, source: "manual", metadata: [:]),
        ]

        #expect(HealthMetricAggregation.cumulativeTotal(in: metrics, type: "steps", on: day, calendar: utcCalendar) == 1_929)
    }

    @Test func authoritativeStatisticsStayConstantWithProductionScaleLegacyHistory() throws {
        let day = try date("2026-08-31T12:00:00Z")
        var metrics = (0..<19_000).map { index in
            metric(
                type: "active_energy",
                value: 1,
                at: day.addingTimeInterval(Double(index % 600)),
                source: index.isMultiple(of: 2) ? "Apple Watch" : "iPhone",
                metadata: ["bundleIdentifier": index.isMultiple(of: 2) ? "watch" : "phone"]
            )
        }
        metrics.append(metric(
            type: "active_energy",
            value: 612,
            at: day,
            source: "Apple Health",
            metadata: ["aggregation": HealthMetricAggregation.statisticsMarker],
            createdAt: day.addingTimeInterval(1_000)
        ))

        #expect(HealthMetricAggregation.cumulativeTotal(in: metrics, type: "active_energy", on: day, calendar: utcCalendar) == 612)
    }

    @Test func sleepUploadUnionsOverlappingSourcesAndPreservesTheirMetadata() throws {
        let sleepStart = try date("2026-08-30T22:00:00Z")
        let samples = [
            HealthSleepIntervalSample(
                externalID: "watch-sleep",
                startAt: sleepStart,
                endAt: try date("2026-08-31T02:00:00Z"),
                sourceName: "Apple Watch",
                bundleIdentifier: "com.apple.health.watch",
                stage: 3
            ),
            HealthSleepIntervalSample(
                externalID: "phone-sleep",
                startAt: try date("2026-08-30T23:00:00Z"),
                endAt: try date("2026-08-31T03:00:00Z"),
                sourceName: "iPhone",
                bundleIdentifier: "com.apple.health.phone",
                stage: 4
            ),
        ]

        let upload = try #require(HealthMetricAggregation.mergedSleepMetrics(from: samples, calendar: utcCalendar).first)
        let expectedEnd = try date("2026-08-31T03:00:00Z")
        #expect(upload.value == 5)
        #expect(upload.startAt == sleepStart)
        #expect(upload.endAt == expectedEnd)
        #expect(upload.source == "Apple Health")
        #expect(upload.metadata["aggregation"] == HealthMetricAggregation.sleepUnionMarker)
        #expect(upload.metadata["sampleCount"] == "2")
        #expect(upload.metadata["sampleExternalIDs"] == "phone-sleep,watch-sleep")
        #expect(upload.metadata["sourceNames"] == "Apple Watch, iPhone")
        #expect(upload.metadata["sourceBundleIdentifiers"] == "com.apple.health.phone,com.apple.health.watch")
    }

    @Test func latestSleepPrefersNewUnionOverLegacyRowsAndKeepsManualSleep() throws {
        let start = try date("2026-08-30T22:00:00Z")
        let metrics = [
            metric(type: "sleep", value: 4, at: start, endAt: try date("2026-08-31T02:00:00Z"), source: "Apple Watch", metadata: ["stage": "3"]),
            metric(type: "sleep", value: 4, at: try date("2026-08-30T23:00:00Z"), endAt: try date("2026-08-31T03:00:00Z"), source: "iPhone", metadata: ["stage": "4"]),
            metric(type: "sleep", value: 5, at: start, endAt: try date("2026-08-31T03:00:00Z"), source: "Apple Health", metadata: ["aggregation": HealthMetricAggregation.sleepUnionMarker], createdAt: try date("2026-08-31T10:00:00Z")),
            metric(type: "sleep", value: 0.5, at: try date("2026-08-31T04:00:00Z"), endAt: try date("2026-08-31T04:30:00Z"), source: "manual", metadata: [:]),
        ]

        #expect(HealthMetricAggregation.latestSleepHours(in: metrics, calendar: utcCalendar) == 5.5)
    }

    @Test func legacySleepIntervalsAreUnionedInsteadOfSummed() throws {
        let metrics = [
            metric(type: "sleep", value: 4, at: try date("2026-08-30T22:00:00Z"), endAt: try date("2026-08-31T02:00:00Z"), source: "Apple Watch", metadata: ["stage": "3"]),
            metric(type: "sleep", value: 4, at: try date("2026-08-30T23:00:00Z"), endAt: try date("2026-08-31T03:00:00Z"), source: "iPhone", metadata: ["stage": "4"]),
        ]

        #expect(HealthMetricAggregation.latestSleepHours(in: metrics, calendar: utcCalendar) == 5)
    }

    private var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }

    private func date(_ value: String) throws -> Date {
        try Date(value, strategy: .iso8601)
    }

    private func metric(
        type: String,
        value: Double,
        at startAt: Date,
        endAt: Date? = nil,
        source: String,
        metadata: [String: String],
        createdAt: Date? = nil
    ) -> LifeHealthMetric {
        LifeHealthMetric(
            id: UUID(),
            externalId: UUID().uuidString,
            type: type,
            value: value,
            unit: type == "steps" ? "count" : type == "sleep" ? "hr" : "unit",
            startAt: startAt,
            endAt: endAt ?? startAt.addingTimeInterval(60),
            source: source,
            metadata: metadata,
            createdAt: createdAt ?? startAt
        )
    }
}
