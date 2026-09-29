import XCTest
@testable import Remember

final class MorningFlowTests: XCTestCase {
    private let calendar = Calendar.current
    private lazy var now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 28, hour: 8, minute: 30))!

    private func at(minutes: Int) -> Date { now.addingTimeInterval(TimeInterval(minutes * 60)) }

    private func task(_ title: String, minutes: Int = 15, priority: LifeTaskPriority = .normal, commitment: UUID? = nil) -> LifeTask {
        var task = LifeTask(
            id: UUID(), goalId: nil, title: title, firstStep: "", notes: "", area: .direction,
            status: .queued, priority: priority, energy: .any, durationMinutes: minutes,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "manual", completedAt: nil,
            createdAt: now, updatedAt: now
        )
        task.commitmentId = commitment
        return task
    }

    private func finished(_ task: LifeTask, at date: Date) -> LifeTask {
        var task = task
        task.status = .done
        task.completedAt = date
        return task
    }

    private lazy var laundry = Commitment(
        id: UUID(), title: "Laundry", kind: .chore, days: 127, everyDays: 7, fixedStart: nil, durationMinutes: 30,
        importance: .normal, steps: [RoutineStep(title: "Gather")], notes: "", active: true, createdAt: now, updatedAt: now
    )
    private lazy var email = task("Email", minutes: 10)
    private lazy var dishes = task("Dishes")
    private lazy var gym = task("Gym", minutes: 60)
    private lazy var college = task("College study", minutes: 120, priority: .must)
    private lazy var trash = task("Trash", minutes: 5)
    private lazy var wash = task("Laundry", minutes: 5, commitment: laundry.id)
    private var tasks: [LifeTask] { [email, dishes, gym, college, trash, wash] }

    func testPicksQuickOnesAndTheMostImportantBigOneLeavingRoutinesOut() {
        let candidates = MorningFlow.candidates(available: tasks, commitments: [laundry])
        XCTAssertEqual(candidates.big?.id, college.id)
        XCTAssertEqual(candidates.small.map(\.title), ["Email", "Dishes", "Trash"])
    }

    func testOffersOnceAMorningAndNotWhileSomethingIsGoing() {
        let candidates = MorningFlow.candidates(available: tasks, commitments: [])
        XCTAssertTrue(MorningFlow.shouldOffer(nil, candidates: candidates, now: now))
        XCTAssertFalse(MorningFlow.shouldOffer(nil, candidates: candidates, now: now, hasActive: true))
        XCTAssertFalse(MorningFlow.shouldOffer(MorningFlow.skip(now: now), candidates: candidates, now: now))
        XCTAssertFalse(MorningFlow.shouldOffer(nil, candidates: candidates, now: at(minutes: 7 * 60)))
        XCTAssertFalse(MorningFlow.shouldOffer(nil, candidates: MorningFlow.candidates(available: [email], commitments: []), now: now))
    }

    func testANightOwlsMorningStartsLater() {
        let day = { (hour: Int) in self.calendar.date(from: DateComponents(year: 2026, month: 9, day: 28, hour: hour))! }
        XCTAssertTrue(MorningFlow.isMorning(day(13), startHour: 12))
        XCTAssertFalse(MorningFlow.isMorning(day(7), startHour: 12))
        XCTAssertTrue(MorningFlow.isMorning(day(1), startHour: 2))
    }

    func testWarmsUpThenMovesToTheBigOneAfterThree() {
        let candidates = MorningFlow.candidates(available: tasks, commitments: [])
        let session = MorningFlow.start(candidates, now: now)
        let first = MorningFlow.pick(session, tasks: tasks, small: candidates.small, now: now)
        XCTAssertEqual(first?.task.id, email.id)
        XCTAssertEqual(first?.label, "WARM-UP · 1 OF 3")

        let later = tasks.map { [email.id, dishes.id, trash.id].contains($0.id) ? finished($0, at: at(minutes: 5)) : $0 }
        let left = MorningFlow.candidates(available: later.filter { $0.status == .queued }, commitments: []).small
        let next = MorningFlow.pick(session, tasks: later, small: left, now: at(minutes: 6))
        XCTAssertEqual(next?.task.id, college.id)
        XCTAssertEqual(next?.label, "THE BIG ONE")
        XCTAssertTrue(MorningFlow.isBigStart(session, taskID: college.id, now: at(minutes: 6)))
    }

    func testStopsTheWarmUpAfterTwentyMinutes() {
        let candidates = MorningFlow.candidates(available: tasks, commitments: [])
        let session = MorningFlow.start(candidates, now: now)
        XCTAssertEqual(MorningFlow.stage(session, tasks: tasks, small: candidates.small, now: at(minutes: 19)), .warmup)
        XCTAssertEqual(MorningFlow.stage(session, tasks: tasks, small: candidates.small, now: at(minutes: 20)), .big)
    }

    func testHandsBackToJevOnceTheBigOneIsDoneOrMovedAside() {
        let candidates = MorningFlow.candidates(available: tasks, commitments: [])
        var session = MorningFlow.start(candidates, now: now)
        session.stage = .big
        let done = tasks.map { $0.id == college.id ? finished($0, at: now) : $0 }
        XCTAssertNil(MorningFlow.pick(session, tasks: done, small: candidates.small, now: now))
        let aside = tasks.map { task -> LifeTask in
            var task = task
            if task.id == college.id { task.notBefore = at(minutes: 60) }
            return task
        }
        XCTAssertNil(MorningFlow.pick(session, tasks: aside, small: candidates.small, now: now))
        XCTAssertNil(MorningFlow.pick(session, tasks: tasks, small: candidates.small, now: at(minutes: 24 * 60)))
    }
}
