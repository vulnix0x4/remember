import XCTest
@testable import Remember

/// Same cases as apps/web/src/services/projects.test.ts, so both platforms file and split alike.
final class ProjectFilerTests: XCTestCase {
    private let base = Date(timeIntervalSince1970: 1_788_000_000)

    private func goal(_ title: String, status: String = "active", order: Int = 0) -> LifeGoal {
        let created = base.addingTimeInterval(TimeInterval(order))
        return LifeGoal(id: UUID(), title: title, area: .direction, vision: "", why: "", status: status, progress: 0,
                        targetDate: nil, createdAt: created, updatedAt: created)
    }

    private func task(_ title: String, in project: LifeGoal?, status: LifeTaskStatus = .done) -> LifeTask {
        LifeTask(
            id: UUID(), goalId: project?.id, title: title, firstStep: "", notes: "", area: .direction,
            status: status, priority: .normal, energy: .any, durationMinutes: 15,
            dueAt: nil, scheduledStart: nil, scheduledEnd: nil, source: "manual", completedAt: nil,
            createdAt: base, updatedAt: base
        )
    }

    private lazy var college = goal("College", order: 0)
    private lazy var app = goal("iOS app", order: 1)
    private var projects: [LifeGoal] { [college, app] }

    func testFilesByKitAndLeavesUnclearTasksLoose() {
        XCTAssertEqual(ProjectFiler.file("Finish the WGU essay", goals: projects, tasks: []), college.id)
        XCTAssertEqual(ProjectFiler.file("Fix the sleep screen crash", goals: projects, tasks: []), app.id)
        XCTAssertEqual(ProjectFiler.file("Email my mentor", goals: projects, tasks: []), college.id)
        XCTAssertNil(ProjectFiler.file("Call mom", goals: projects, tasks: []))
        XCTAssertEqual(ProjectFiler.file("Read chapter 5", goals: projects, tasks: []), college.id)
        XCTAssertNil(ProjectFiler.file("Gym", goals: projects, tasks: []))
        XCTAssertEqual(ProjectFiler.file("Submit C683 task 2", goals: projects, tasks: []), college.id)
    }

    func testMatchesTheProjectName() {
        XCTAssertEqual(ProjectFiler.file("College application form", goals: projects, tasks: []), college.id)
        let side = goal("Side app")
        XCTAssertEqual(ProjectFiler.file("Pay for app icon", goals: [side], tasks: []), side.id)
    }

    func testLearnsFromEarlierTasksUpToTwoPerWord() {
        let selfCare = goal("Self care", order: 2)
        let goals = projects + [selfCare]
        XCTAssertNil(ProjectFiler.file("Gym", goals: goals, tasks: [task("Gym", in: selfCare)]))
        XCTAssertEqual(ProjectFiler.file("Gym", goals: goals, tasks: [task("Gym", in: selfCare), task("Gym legs", in: selfCare)]), selfCare.id)
        XCTAssertNil(ProjectFiler.file("Gym", goals: goals, tasks: [task("Gym", in: selfCare, status: .removed), task("Gym legs", in: selfCare)]))
    }

    func testStaysLooseOnATie() {
        XCTAssertNil(ProjectFiler.file("Write the essay", goals: [college, goal("School stuff", order: 3)], tasks: []))
    }

    func testUsesTheProjectInFocusButNeverAPausedOne() {
        XCTAssertEqual(ProjectFiler.file("Call mom", goals: projects, tasks: [], focusProjectId: app.id), app.id)
        let paused = goal("Paused", status: "paused")
        XCTAssertEqual(ProjectFiler.file("Finish the WGU essay", goals: [college, paused], tasks: [], focusProjectId: paused.id), college.id)
        XCTAssertNil(ProjectFiler.file("Finish the WGU essay", goals: [goal("College", status: "paused")], tasks: []))
    }

    func testChipCyclesThroughActiveProjectsThenNone() {
        XCTAssertEqual(ProjectFiler.next(after: nil, goals: projects), .project(college.id))
        XCTAssertEqual(ProjectFiler.next(after: college.id, goals: projects), .project(app.id))
        XCTAssertEqual(ProjectFiler.next(after: app.id, goals: projects), ProjectFiler.Pick.none)
        XCTAssertEqual(ProjectFiler.next(after: nil, goals: []), ProjectFiler.Pick.none)
    }

    func testSplitsAMessyParagraph() {
        XCTAssertEqual(
            ProjectFiler.splitDump("ok i need to finish the WGU essay, fix the sleep screen crash, call mom, and email my mentor"),
            ["finish the WGU essay", "fix the sleep screen crash", "call mom", "email my mentor"]
        )
    }

    func testKeepsAListInsideOneTaskTogether() {
        XCTAssertEqual(ProjectFiler.splitDump("Buy eggs, milk, bread"), [])
        XCTAssertEqual(ProjectFiler.splitDump("Call mom tomorrow 20m"), [])
        XCTAssertEqual(ProjectFiler.splitDump("Finish the essay and fix the crash"), [])
    }

    func testSplitsLinesAndSentences() {
        XCTAssertEqual(ProjectFiler.splitDump("gym\nlaundry\nemail sam"), ["gym", "laundry", "email sam"])
        XCTAssertEqual(
            ProjectFiler.splitDump("Finish the essay. Fix the crash. Call mom and email my mentor."),
            ["Finish the essay", "Fix the crash", "Call mom", "email my mentor"]
        )
    }

    func testKeepsTimeAndDayWordsWithTheirTask() {
        XCTAssertEqual(ProjectFiler.splitDump("gym tomorrow, 45 min; call mom tonight"), ["gym tomorrow 45 min", "call mom tonight"])
    }
}
