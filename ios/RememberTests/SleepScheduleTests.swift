import XCTest
@testable import Remember

/// A night from Going to bed to I'm up, and the one rule the phone lock follows.
final class SleepSessionTests: XCTestCase {
    private let bed = Date(timeIntervalSince1970: 1_790_000_000)
    private func minutes(_ value: Double) -> Date { bed.addingTimeInterval(value * 60) }

    func testWindsDownForAnHourThenSleepsUntilImUp() {
        var night = SleepSession(bedAt: bed, morningMinutes: 60)
        XCTAssertNil(night.phase(at: minutes(-1)))
        XCTAssertEqual(night.phase(at: minutes(0)), .windDown)
        XCTAssertEqual(night.phase(at: minutes(59)), .windDown)
        XCTAssertEqual(night.phase(at: minutes(60)), .sleep)
        XCTAssertEqual(night.phase(at: minutes(13 * 60)), .sleep)
        // Nobody tapped I'm up: phone-free ends by itself 14 hours after Going to bed.
        XCTAssertNil(night.phase(at: minutes(14 * 60)))

        night.upAt = minutes(8 * 60)
        XCTAssertEqual(night.phase(at: minutes(8 * 60)), .morning)
        XCTAssertEqual(night.phase(at: minutes(8 * 60 + 59)), .morning)
        XCTAssertNil(night.phase(at: minutes(9 * 60)))
        XCTAssertEqual(night.ends, minutes(9 * 60))
    }

    func testNoPhoneFreeMorningEndsTheNightAtImUp() {
        let night = SleepSession(bedAt: bed, upAt: minutes(7 * 60), morningMinutes: 0)
        XCTAssertNil(night.phase(at: minutes(7 * 60)))
        XCTAssertEqual(night.phase(at: minutes(7 * 60 - 1)), .sleep)
    }

    func testTheLockHoldsExceptDuringAFifteenMinuteUnlock() {
        var night = SleepSession(bedAt: bed, morningMinutes: 60)
        XCTAssertTrue(night.shields(at: minutes(90)))
        night.pausedUntil = minutes(105)
        XCTAssertFalse(night.shields(at: minutes(100)))
        XCTAssertTrue(night.shields(at: minutes(105)))
        XCTAssertFalse(night.shields(at: minutes(-5)))
    }
}

/// Mirrors packages/domain/test/sleep.test.ts, so iOS and the web agree on every number and word.
final class SleepMathTests: XCTestCase {
    private func week(_ change: (inout SleepWeekNumbers) -> Void = { _ in }) -> SleepWeekNumbers {
        var week = SleepWeekNumbers(nights: 7, averageHours: 7.6, usualBedtime: SleepMath.afterEvening("23:30"), bedtimeRangeMinutes: 40,
                                    wakeRangeMinutes: 30, averageLatencyMinutes: 20, latencyAnswers: 5, usualWake: nil)
        change(&week)
        return week
    }

    func testSettingsHaveNoSetTimesAndSurviveOlderServers() throws {
        let old = #"{"enabled":true,"timeZone":"UTC","startHour":8,"endHour":22,"preferences":""}"#
        XCTAssertEqual(try JSONDecoder().decode(BrainSettings.self, from: Data(old.utf8)).sleep, SleepSettings())
        let earlier = #"{"enabled":true,"wakeTime":"07:30","bedTime":"23:30","morningMinutes":30}"#
        XCTAssertEqual(try JSONDecoder().decode(SleepSettings.self, from: Data(earlier.utf8)), SleepSettings(enabled: true, morningMinutes: 30))
    }

    func testFindsTheUsualBedtimeAcrossMidnight() {
        XCTAssertEqual(SleepMath.median(["23:40", "00:20", "01:10"].map(SleepMath.afterEvening)), SleepMath.afterEvening("00:20"))
        XCTAssertEqual(SleepMath.median(["23:00", "00:00"].map(SleepMath.afterEvening)), SleepMath.afterEvening("23:30"))
        XCTAssertNil(SleepMath.median([]))
    }

    func testPicksOneTipFirstRuleFirst() {
        XCTAssertEqual(SleepTip(week { $0.nights = 2 }).title, "Two taps a day")
        XCTAssertEqual(SleepTip(week { $0.wakeRangeMinutes = 95; $0.bedtimeRangeMinutes = 200 }).title, "Same wake-up time, every day")
        XCTAssertEqual(SleepTip(week { $0.bedtimeRangeMinutes = 120 }),
                       SleepTip(title: "Keep bedtime steady", line: "Your bedtime moved by 2 hr this week. Steadier nights make easier mornings."))
        XCTAssertEqual(SleepTip(week { $0.averageLatencyMinutes = 70 }).title, "Slow to fall asleep?")
        XCTAssertEqual(SleepTip(week { $0.averageLatencyMinutes = 70; $0.latencyAnswers = 2 }).title, "You’re on track")
        XCTAssertEqual(SleepTip(week { $0.averageHours = 6.14 }).line, "About 6.1 hr a night. Try Going to bed 30 minutes earlier.")
        XCTAssertEqual(SleepTip(week { $0.usualBedtime = SleepMath.afterEvening("01:30") }).title, "Get daylight early")
        XCTAssertEqual(SleepTip(week()).title, "You’re on track")
    }

    func testWritesDurationsTheWayTheRestOfTheAppDoes() {
        XCTAssertEqual(SleepMath.durationLabel(minutes: 90), "1 hr 30 min")
        XCTAssertEqual(SleepMath.durationLabel(minutes: 120), "2 hr")
        XCTAssertEqual(SleepMath.durationLabel(minutes: 45), "45 min")
    }
}

final class SleepInsightsTests: XCTestCase {
    private let calendar = Calendar.current

    private func date(day: Int, hour: Int, minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour, minute: minute))!
    }

    private func metric(_ upload: HealthMetricUpload) -> LifeHealthMetric {
        LifeHealthMetric(id: UUID(), externalId: upload.externalId, type: upload.type, value: upload.value, unit: upload.unit,
                         startAt: upload.startAt, endAt: upload.endAt, source: upload.source, metadata: upload.metadata, createdAt: .now)
    }

    private func health(_ start: Date, _ end: Date) -> LifeHealthMetric {
        LifeHealthMetric(id: UUID(), externalId: "hk", type: "sleep", value: end.timeIntervalSince(start) / 3600, unit: "hr",
                         startAt: start, endAt: end, source: "Apple Health", metadata: ["aggregation": HealthMetricAggregation.sleepUnionMarker], createdAt: .now)
    }

    func testSavesTheNightFromTheTwoTapsAndTheCheckIn() throws {
        let night = SleepSession(bedAt: date(day: 27, hour: 23, minute: 40), upAt: date(day: 28, hour: 7, minute: 40), morningMinutes: 60)
        let plain = try XCTUnwrap(SleepInsights.savedNight(night))
        XCTAssertEqual(plain.externalId, "remember.night.2026-09-27")
        XCTAssertEqual(plain.value, 8)
        XCTAssertNil(plain.metadata["rating"])

        let answered = try XCTUnwrap(SleepInsights.savedNight(night, rating: .okay, latency: .hour))
        XCTAssertEqual(answered.startAt, date(day: 28, hour: 0, minute: 40))
        XCTAssertEqual(answered.value, 7)
        XCTAssertEqual(answered.metadata["rating"], "okay")
        XCTAssertEqual(answered.metadata["latency"], "60")
        XCTAssertNotNil(answered.metadata["bedAt"])
        XCTAssertNil(SleepInsights.savedNight(SleepSession(bedAt: date(day: 27, hour: 23), morningMinutes: 60)))
    }

    func testMergesAppleHealthTimesWithTheSavedNight() throws {
        let session = SleepSession(bedAt: date(day: 27, hour: 23, minute: 40), upAt: date(day: 28, hour: 7, minute: 40), morningMinutes: 60)
        let saved = metric(try XCTUnwrap(SleepInsights.savedNight(session, rating: .rough, latency: .hourAndHalf)))
        let measured = health(date(day: 28, hour: 0, minute: 30), date(day: 28, hour: 7, minute: 35))
        let nights = SleepInsights.nights(from: [saved, measured])
        XCTAssertEqual(nights.count, 1)
        XCTAssertEqual(nights[0].fellAsleep, measured.startAt)
        XCTAssertEqual(nights[0].rating, .rough)
        XCTAssertEqual(nights[0].latencyMinutes, 90)
        XCTAssertEqual(nights[0].bedAt, session.bedAt)
        XCTAssertTrue(nights[0].fromHealth)
    }

    func testASavedNightStaysOnItsNightEvenAfterAnAfternoonGetUp() throws {
        // Asleep at 3 AM, up at 12:30 PM: the key comes from I'm up, and stays put.
        let session = SleepSession(bedAt: date(day: 28, hour: 3), upAt: date(day: 28, hour: 12, minute: 30), morningMinutes: 60)
        let saved = metric(try XCTUnwrap(SleepInsights.savedNight(session)))
        XCTAssertEqual(SleepInsights.nights(from: [saved]).map(\.key), ["2026-09-28"])
    }

    func testSavedNightsNeverAddToAppleHealthHours() throws {
        let session = SleepSession(bedAt: date(day: 27, hour: 23), upAt: date(day: 28, hour: 7), morningMinutes: 60)
        let saved = metric(try XCTUnwrap(SleepInsights.savedNight(session)))
        XCTAssertEqual(HealthMetricAggregation.latestSleepHours(in: [saved, health(date(day: 28, hour: 0), date(day: 28, hour: 7))]), 7)
        XCTAssertEqual(HealthMetricAggregation.latestSleepHours(in: [saved]), 8)
    }

    func testAWeekOfNightsBecomesTheTipsNumbers() {
        let nights = [(23, 40, 7, 30), (0, 50, 7, 45), (23, 10, 8, 0)].enumerated().map { index, times in
            let day = 20 + index
            let bedAt = date(day: times.0 < 12 ? day + 1 : day, hour: times.0, minute: times.1)
            return SleepNight(key: "2026-09-\(day)", fellAsleep: bedAt.addingTimeInterval(20 * 60), gotUp: date(day: day + 1, hour: times.2, minute: times.3),
                              hours: 7, bedAt: bedAt, rating: nil, latencyMinutes: index == 0 ? nil : 60, fromHealth: false)
        }
        let week = SleepInsights.week(nights)
        XCTAssertEqual(week.usualBedtime, SleepMath.afterEvening("23:40"))
        XCTAssertEqual(week.bedtimeRangeMinutes, 100)
        XCTAssertEqual(week.wakeRangeMinutes, 30)
        XCTAssertEqual(week.averageLatencyMinutes, 60)
        XCTAssertEqual(week.latencyAnswers, 2)
        XCTAssertEqual(SleepTip(week).title, "Keep bedtime steady")
    }

    func testLastWeekKeepsTheNewestSevenIncludingANightOwlsMorning() {
        let nights = (0...9).map { back in
            SleepNight(key: String(format: "2026-09-%02d", 28 - back), fellAsleep: date(day: 20, hour: 23), gotUp: date(day: 21, hour: 7), hours: 8, fromHealth: true)
        }
        XCTAssertEqual(SleepInsights.lastWeek(nights, today: "2026-09-28").map(\.key),
                       ["2026-09-28", "2026-09-27", "2026-09-26", "2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22"])
    }

    func testTheCheckInWaitsForImUpAndGoesAwayOnceAnswered() throws {
        let asleep = SleepSession(bedAt: date(day: 27, hour: 23), morningMinutes: 60)
        XCTAssertNil(SleepInsights.dueCheckIn(asleep, metrics: [], at: date(day: 28, hour: 6)))
        let up = SleepSession(bedAt: date(day: 27, hour: 23), upAt: date(day: 28, hour: 7), morningMinutes: 60)
        XCTAssertNotNil(SleepInsights.dueCheckIn(up, metrics: [], at: date(day: 28, hour: 7)))
        XCTAssertNil(SleepInsights.dueCheckIn(up, metrics: [], at: date(day: 28, hour: 15)))
        // Saved at I'm up without a rating: still due. With one: done.
        let unrated = metric(try XCTUnwrap(SleepInsights.savedNight(up)))
        XCTAssertNotNil(SleepInsights.dueCheckIn(up, metrics: [unrated], at: date(day: 28, hour: 8)))
        let rated = metric(try XCTUnwrap(SleepInsights.savedNight(up, rating: .great)))
        XCTAssertNil(SleepInsights.dueCheckIn(up, metrics: [rated], at: date(day: 28, hour: 8)))
    }
}

/// Going to bed, I'm up, Undo, and the unlock, on a device of its own.
@MainActor
final class SleepGuardTests: XCTestCase {
    /// Tonight lives in the app group, which the app running on this simulator shares; start clean and put it back.
    private var savedSession: SleepSession?

    override func setUp() async throws {
        savedSession = SleepShieldCore.session
        SleepShieldCore.session = nil
    }

    override func tearDown() async throws {
        SleepShieldCore.session = savedSession
    }

    func testTheTwoTapsWithUndo() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "remember.tests.sleep.\(UUID().uuidString)"))
        let guardian = SleepGuard(defaults: defaults)
        guardian.update(SleepSettings(enabled: true, morningMinutes: 30))
        let bed = Date.now

        let before = guardian.goToBed(now: bed)
        XCTAssertEqual(guardian.phoneFree(at: bed.addingTimeInterval(60))?.phase, .windDown)
        guardian.restore(before)
        XCTAssertNil(guardian.phoneFree(at: bed.addingTimeInterval(60)))

        guardian.goToBed(now: bed)
        guardian.toggle("Lights low")
        XCTAssertTrue(guardian.isChecked("Lights low"))
        let night = try XCTUnwrap(guardian.wakeUp(now: bed.addingTimeInterval(8 * 3600)))
        XCTAssertEqual(night.morningMinutes, 30)
        XCTAssertEqual(guardian.phoneFree(at: bed.addingTimeInterval(8 * 3600 + 60))?.phase, .morning)
        guardian.undoWakeUp()
        XCTAssertEqual(guardian.phoneFree(at: bed.addingTimeInterval(8 * 3600 + 60))?.phase, .sleep)

        guardian.pause(now: bed.addingTimeInterval(8 * 3600))
        XCTAssertNil(guardian.phoneFree(at: bed.addingTimeInterval(8 * 3600 + 60)))
        XCTAssertEqual(guardian.session?.unlocks, 1)

        // A new night starts a fresh checklist; turning phone-free nights off ends tonight's.
        guardian.goToBed(now: .now)
        XCTAssertFalse(guardian.isChecked("Lights low"))
        guardian.update(SleepSettings(enabled: false))
        XCTAssertNil(guardian.session)
    }
}
