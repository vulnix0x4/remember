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

final class AutomaticRepeatTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    func testCommonChoresGetTheirUsualRhythm() {
        let laundry = QuickTaskParser.parse("laundry", now: now)
        XCTAssertEqual(laundry.title, "Laundry")
        XCTAssertEqual(laundry.repeatEveryDays, 7)
        XCTAssertEqual(laundry.repeatSource, .usual)
        XCTAssertEqual(QuickTaskParser.parse("do the dishes", now: now).repeatEveryDays, 1)
        XCTAssertEqual(QuickTaskParser.parse("change sheets", now: now).repeatEveryDays, 14)
        XCTAssertEqual(QuickTaskParser.parse("pay rent by friday", now: now).repeatEveryDays, 30)
        XCTAssertEqual(QuickTaskParser.parse("replace air filter", now: now).repeatEveryDays, 90)
        XCTAssertEqual(QuickTaskParser.parse("book dentist", now: now).repeatEveryDays, 180)
    }

    func testTypedRhythmAndOnceWin() {
        let typed = QuickTaskParser.parse("laundry every 3 days", now: now)
        XCTAssertEqual(typed.repeatEveryDays, 3)
        XCTAssertEqual(typed.repeatSource, .typed)
        let once = QuickTaskParser.parse("laundry once", now: now)
        XCTAssertEqual(once.title, "Laundry")
        XCTAssertNil(once.repeatEveryDays)
    }

    func testOneOffTasksStayOneOff() {
        XCTAssertNil(QuickTaskParser.parse("email sam", now: now).repeatEveryDays)
        XCTAssertNil(QuickTaskParser.parse("buy a rental car", now: now).repeatEveryDays)
    }

    func testLearnsThePersonsRhythm() {
        let history = [
            QuickTaskParser.HistoryEntry(title: "Clean litter box", completedAt: now.addingTimeInterval(-6 * 86_400)),
            QuickTaskParser.HistoryEntry(title: "clean litter box", completedAt: now.addingTimeInterval(-3 * 86_400)),
        ]
        let learned = QuickTaskParser.parse("clean litter box", now: now, history: history)
        XCTAssertEqual(learned.repeatEveryDays, 3)
        XCTAssertEqual(learned.repeatSource, .learned)
        XCTAssertEqual(QuickTaskParser.learnedRepeatDays(for: "Laundry", history: [.init(title: "laundry", completedAt: now.addingTimeInterval(-14 * 86_400))], now: now), 14)
    }
}

final class TimeEstimateTests: XCTestCase {
    func testKnownTasksGetARealisticEstimate() {
        XCTAssertEqual(QuickTaskParser.estimateMinutes(for: "Go to the gym", history: []), 60)
        XCTAssertEqual(QuickTaskParser.estimateMinutes(for: "Groceries", history: []), 45)
        XCTAssertEqual(QuickTaskParser.estimateMinutes(for: "Email the landlord", history: []), 10)
        XCTAssertEqual(QuickTaskParser.estimateMinutes(for: "Something new", history: []), 15)
    }

    func testYourOwnTimingWins() {
        let history = [20, 40, 30].enumerated().map { index, minutes in
            QuickTaskParser.HistoryEntry(title: "Groceries", completedAt: .now.addingTimeInterval(Double(-index) * 86_400), actualMinutes: minutes)
        }
        XCTAssertEqual(QuickTaskParser.estimateMinutes(for: "groceries", history: history), 30)
    }

    func testTypedDurationIsNotAnEstimate() {
        let typed = QuickTaskParser.parse("gym 45m")
        XCTAssertEqual(typed.durationMinutes, 45)
        XCTAssertFalse(typed.durationIsEstimate)
        let guessed = QuickTaskParser.parse("gym")
        XCTAssertEqual(guessed.durationMinutes, 60)
        XCTAssertTrue(guessed.durationIsEstimate)
    }
}

final class WeekdaysTests: XCTestCase {
    func testLabels() {
        XCTAssertEqual(Weekdays.label(127), "Every day")
        XCTAssertEqual(Weekdays.label(Weekdays.weekdays), "Weekdays")
        XCTAssertEqual(Weekdays.label(2 | 8 | 32), "Mon, Wed, Fri")
    }

    func testCommitmentSummary() {
        let gym = Commitment(id: UUID(), title: "Gym", kind: .commitment, days: 2 | 8 | 32, everyDays: nil, fixedStart: nil,
                             durationMinutes: 60, importance: .high, steps: [], notes: "", active: true, createdAt: .now, updatedAt: .now)
        XCTAssertEqual(gym.summary, "Mon, Wed, Fri · 1 hr")
        var laundry = gym
        laundry.kind = .chore
        laundry.days = 127
        laundry.everyDays = 7
        laundry.durationMinutes = 30
        XCTAssertEqual(laundry.summary, "Weekly · 30 min")
    }

    func testCommitmentDecodesFromTheServer() throws {
        let json = #"{"id":"6f1d2c3b-1111-4222-8333-944455556666","title":"Laundry","kind":"chore","days":127,"everyDays":7,"fixedStart":null,"durationMinutes":30,"importance":"high","steps":[{"title":"Gather clothes"},{"title":"Washer running","waitMinutes":45}],"notes":"","active":true,"createdAt":"2026-09-23T10:00:00Z","updatedAt":"2026-09-23T10:00:00Z"}"#
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let commitment = try decoder.decode(Commitment.self, from: Data(json.utf8))
        XCTAssertEqual(commitment.steps.map(\.waitMinutes), [nil, 45])
        let encoded = String(decoding: try JSONEncoder().encode(CommitmentDraft(commitment)), as: UTF8.self)
        XCTAssertTrue(encoded.contains(#""everyDays":7"#))
        XCTAssertTrue(encoded.contains(#""fixedStart":null"#))
    }
}
