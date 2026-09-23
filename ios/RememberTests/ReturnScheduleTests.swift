import Foundation
import Testing
@testable import Remember

struct ReturnScheduleTests {
    @Test func schedulesAtLocalMidnightAcrossDaylightSaving() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Denver"))
        let now = try Date("2026-03-07T20:00:00Z", strategy: .iso8601)
        let selected = try Date("2026-03-09T20:00:00Z", strategy: .iso8601)
        #expect(try ReturnSchedule.instant(for: selected, now: now, calendar: calendar) == Date("2026-03-09T06:00:00Z", strategy: .iso8601))
        #expect(ReturnSchedule.tomorrow(now: now, calendar: calendar) == calendar.date(from: DateComponents(year: 2026, month: 3, day: 8)))
    }

    @Test func choosingTodaySchedulesAfterAnEarlierCheckIn() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Denver"))
        let now = try Date("2026-09-08T01:30:00Z", strategy: .iso8601)
        let chosenDay = try Date("2026-09-07T06:00:00Z", strategy: .iso8601)
        #expect(try ReturnSchedule.instant(for: chosenDay, now: now, calendar: calendar) == now)
        #expect(throws: ReturnSchedule.InvalidDay.self) {
            try ReturnSchedule.instant(for: now.addingTimeInterval(-86400), now: now, calendar: calendar)
        }
    }
}
