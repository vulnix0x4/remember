import Foundation
import Testing
@testable import Remember

@MainActor
struct AppStoreMutationTests {
    @Test func todayAndPlanShareOneRecommendationAndRespectJevWhenEnabled() {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: false))
        let plannedTask = FixtureLibrary.lifeSnapshot.tasks[0]
        var urgentTask = LifeTask(
            id: UUID(), goalId: nil, title: "Send the urgent update", firstStep: "",
            notes: "", area: .work, status: .queued, priority: .must, energy: .any,
            durationMinutes: 15, dueAt: nil, scheduledStart: nil, scheduledEnd: nil,
            source: "manual", completedAt: nil, createdAt: .now, updatedAt: .now
        )
        store.lifeSnapshot.tasks = [plannedTask, urgentTask]

        #expect(store.suggestedLifeTask?.id == urgentTask.id)

        let settings = BrainSettings(enabled: true, timeZone: "America/Denver", startHour: 8, endHour: 21, preferences: "")
        store.brain = BrainState(
            settings: settings, status: "ready", message: "", model: nil,
            evaluatedAt: nil, nextCheckAt: nil,
            plan: [BrainBlock(
                taskId: plannedTask.id, title: plannedTask.title, firstStep: plannedTask.firstStep,
                startAt: .now, endAt: .now.addingTimeInterval(900), confidence: 0.9,
                reason: "Fits this time"
            )],
            contextUsed: [], unscheduledCount: 1
        )
        #expect(store.suggestedLifeTask?.id == plannedTask.id)
        #expect(store.queuedLifeTasks.first?.id == plannedTask.id)

        urgentTask.notBefore = .now.addingTimeInterval(3600)
        store.lifeSnapshot.tasks = [urgentTask]
        #expect(store.suggestedLifeTask == nil)
    }

    @Test func createFormsReceiveFailureWithoutTriggeringTheGlobalAlert() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: true))

        let taskSucceeded = await store.createLifeTask(
            title: "Open the project",
            firstStep: "Open Xcode",
            area: .work,
            duration: 15
        )
        let goalSucceeded = await store.createLifeGoal(title: "Ship Remember", area: .direction, why: "Use it daily")
        let floorSucceeded = await store.createLifeFloorItem(title: "Take medication", area: .health, target: 1, unit: "time")
        let accountSucceeded = await store.addFinanceAccount(name: "Checking", institution: "Bank", type: "checking", balance: 125)
        let transactionSucceeded = await store.addFinanceTransaction(accountId: nil, name: "Groceries", amount: -42, category: "Food")

        #expect(!taskSucceeded)
        #expect(!goalSucceeded)
        #expect(!floorSucceeded)
        #expect(!accountSucceeded)
        #expect(!transactionSucceeded)
        #expect(store.errorMessage == nil)
        #expect(!store.errorIsPresented)
    }

    @Test func createFormsReceiveSuccessOnlyAfterTheRepositoryAcceptsTheMutation() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: false))

        let taskSucceeded = await store.createLifeTask(
            title: "Open the project",
            firstStep: "Open Xcode",
            area: .work,
            duration: 15
        )
        let goalSucceeded = await store.createLifeGoal(title: "Ship Remember", area: .direction, why: "Use it daily")
        let floorSucceeded = await store.createLifeFloorItem(title: "Take medication", area: .health, target: 1, unit: "time")
        let accountSucceeded = await store.addFinanceAccount(name: "Checking", institution: "Bank", type: "checking", balance: 125)
        let transactionSucceeded = await store.addFinanceTransaction(accountId: nil, name: "Groceries", amount: -42, category: "Food")

        #expect(taskSucceeded)
        #expect(goalSucceeded)
        #expect(floorSucceeded)
        #expect(accountSucceeded)
        #expect(transactionSucceeded)
    }

    @Test func taskCompletionAndBlockingExposeRepositoryFailure() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: true))
        let taskID = UUID()

        let completionSucceeded = await store.completeLifeTask(taskID, minutesSpent: 12)
        let blockingSucceeded = await store.blockLifeTask(taskID, reason: .unclear)

        #expect(!completionSucceeded)
        #expect(!blockingSucceeded)
        #expect(store.errorIsPresented)
        #expect(store.errorMessage == "Remember could not adjust that task.")
    }

    @Test func taskCompletionAndBlockingReportConfirmedServerSuccess() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: false))
        let taskID = UUID()

        let completionSucceeded = await store.completeLifeTask(taskID, minutesSpent: 12)
        let blockingSucceeded = await store.blockLifeTask(taskID, reason: .unclear)

        #expect(completionSucceeded)
        #expect(blockingSucceeded)
    }

    @Test func vaultUploadReturnsFailureWithoutPresentingAnUnrelatedGlobalAlert() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: true))

        let succeeded = await store.uploadLifeFile(
            data: Data("file contents".utf8),
            name: "notes.txt",
            mimeType: "text/plain"
        )

        #expect(!succeeded)
        #expect(store.errorMessage == nil)
        #expect(!store.errorIsPresented)
    }

    @Test func vaultUploadReportsConfirmedServerSuccess() async {
        let store = makeStore(lifeRepository: TestLifeOSRepository(shouldFail: false))

        let succeeded = await store.uploadLifeFile(
            data: Data("file contents".utf8),
            name: "notes.txt",
            mimeType: "text/plain"
        )

        #expect(succeeded)
    }

    private func makeStore(lifeRepository: any LifeOSRepository) -> AppStore {
        let client = APIClient(baseURL: .temporaryDirectory, credentials: APICredentials(bearerToken: nil))
        let imprintRepository = LiveImprintRepository(client: client)
        return AppStore(repository: imprintRepository, lifeRepository: lifeRepository)
    }
}
