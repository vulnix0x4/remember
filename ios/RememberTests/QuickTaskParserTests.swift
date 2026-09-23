import XCTest
@testable import Remember

final class QuickTaskParserTests: XCTestCase {
    private var calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }()

    /// Wednesday, September 23, 2026 at the given local hour.
    private func wednesday(hour: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: 23, hour: hour))!
    }

    private func date(day: Int, hour: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour))!
    }

    private func parse(_ text: String, hour: Int = 10) -> ParsedQuickTask {
        QuickTaskParser.parse(text, now: wednesday(hour: hour), calendar: calendar)
    }

    func testTomorrowAndMinutes() {
        let result = parse("Call mom tomorrow 20m")
        XCTAssertEqual(result.title, "Call mom")
        XCTAssertEqual(result.durationMinutes, 20)
        XCTAssertEqual(result.notBefore, date(day: 24, hour: 9))
    }

    func testRepeatAndHours() {
        let result = parse("laundry every week 1h")
        XCTAssertEqual(result.title, "Laundry")
        XCTAssertEqual(result.durationMinutes, 60)
        XCTAssertEqual(result.repeatEveryDays, 7)
        XCTAssertNil(result.notBefore)
    }

    func testDeadlineAndPriority() {
        let result = parse("pay rent by friday !")
        XCTAssertEqual(result.title, "Pay rent")
        XCTAssertEqual(result.dueAt, date(day: 25, hour: 17))
        XCTAssertNil(result.notBefore)
        XCTAssertEqual(result.priority, .high)
    }

    func testPlainTitleIsUntouched() {
        let result = parse("email sam")
        XCTAssertEqual(result.title, "Email sam")
        XCTAssertFalse(result.hasDetails)
    }

    func testEmptyTitleFallsBackToOriginalText() {
        let result = parse("today")
        XCTAssertEqual(result.title, "today")
        XCTAssertFalse(result.hasDetails)
    }

    func testTonightAfterSixHasNoStart() {
        let result = parse("gym tonight 45 min", hour: 20)
        XCTAssertEqual(result.title, "Gym")
        XCTAssertEqual(result.durationMinutes, 45)
        XCTAssertNil(result.notBefore)
    }

    func testTonightBeforeSixStartsAtSix() {
        XCTAssertEqual(parse("gym tonight").notBefore, date(day: 23, hour: 18))
    }

    func testWeekdayIsStrictlyAfterToday() {
        XCTAssertEqual(parse("dentist on wed").notBefore, date(day: 30, hour: 9))
        XCTAssertEqual(parse("dentist next thursday").notBefore, date(day: 24, hour: 9))
    }

    func testNextWeekAndWeekend() {
        XCTAssertEqual(parse("plan trip next week").notBefore, date(day: 28, hour: 9))
        XCTAssertEqual(parse("clean garage this weekend").notBefore, date(day: 26, hour: 9))
    }

    func testRepeatVariants() {
        XCTAssertEqual(parse("vitamins daily").repeatEveryDays, 1)
        XCTAssertEqual(parse("water plants every 3 days").repeatEveryDays, 3)
        XCTAssertEqual(parse("stretch every other day").repeatEveryDays, 2)
        XCTAssertEqual(parse("budget monthly").repeatEveryDays, 30)
    }

    func testDurationVariantsAndClamp() {
        XCTAssertEqual(parse("read half an hour").durationMinutes, 30)
        XCTAssertEqual(parse("deep work 1.5 hours").durationMinutes, 90)
        XCTAssertEqual(parse("walk an hour").durationMinutes, 60)
        XCTAssertEqual(parse("tidy 1 min").durationMinutes, 2)
    }

    func testUrgentIsMust() {
        let result = parse("renew passport urgent")
        XCTAssertEqual(result.title, "Renew passport")
        XCTAssertEqual(result.priority, .must)
        XCTAssertEqual(parse("taxes !!").priority, .must)
    }

    func testWordsContainingDayNamesAreKept() {
        XCTAssertEqual(parse("buy sunscreen").title, "Buy sunscreen")
        XCTAssertNil(parse("buy sunscreen").notBefore)
    }
}
