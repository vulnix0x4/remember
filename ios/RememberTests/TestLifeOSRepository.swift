import Foundation
@testable import Remember

actor TestLifeOSRepository: LifeOSRepository {
    private let shouldFail: Bool

    init(shouldFail: Bool) {
        self.shouldFail = shouldFail
    }

    func load() async throws -> LifeSnapshot {
        try failIfNeeded()
        return .empty
    }

    func createTask(_ request: CreateLifeTaskRequest) async throws -> LifeTask {
        try failIfNeeded()
        return LifeTask(
            id: UUID(),
            goalId: request.goalId,
            title: request.title,
            firstStep: request.firstStep,
            notes: request.notes,
            area: request.area,
            status: request.status,
            priority: request.priority,
            energy: request.energy,
            durationMinutes: request.durationMinutes,
            dueAt: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            source: request.source,
            sourceItemId: request.sourceItemId,
            completedAt: nil,
            createdAt: .now,
            updatedAt: .now
        )
    }

    func activateTask(id: UUID) async throws {
        try failIfNeeded()
    }

    func updateTask(id: UUID, patch: LifeTaskPatch) async throws {
        try failIfNeeded()
    }

    func completeTask(id: UUID, minutesSpent: Int, result: PracticeResult?) async throws {
        try failIfNeeded()
    }

    func reflectOnPractice(id: UUID, result: PracticeResult) async throws {
        try failIfNeeded()
    }

    func blockTask(id: UUID, reason: LifeBlockerReason) async throws {
        try failIfNeeded()
    }

    func saveCommitment(id: UUID?, draft: CommitmentDraft) async throws -> Commitment {
        try failIfNeeded()
        return Commitment(id: id ?? UUID(), title: draft.title, kind: draft.kind, days: draft.days, everyDays: draft.everyDays, fixedStart: draft.fixedStart, durationMinutes: draft.durationMinutes, importance: draft.importance, steps: draft.steps, notes: draft.notes, active: draft.active, createdAt: .now, updatedAt: .now)
    }

    func deleteCommitment(id: UUID) async throws {
        try failIfNeeded()
    }

    func updateGoal(id: UUID, progress: Int?, status: String?) async throws {
        try failIfNeeded()
    }

    func createGoal(_ request: CreateLifeGoalRequest) async throws -> LifeGoal {
        try failIfNeeded()
        return LifeGoal(
            id: UUID(),
            title: request.title,
            area: request.area,
            vision: request.vision,
            why: request.why,
            status: "active",
            progress: 0,
            targetDate: nil,
            createdAt: .now,
            updatedAt: .now
        )
    }

    func createFloorItem(_ request: CreateLifeFloorRequest) async throws -> LifeFloorItem {
        try failIfNeeded()
        return LifeFloorItem(
            id: UUID(),
            title: request.title,
            area: request.area,
            target: request.target,
            unit: request.unit,
            completionDates: [],
            createdAt: .now,
            updatedAt: .now
        )
    }

    func toggleFloorItem(id: UUID, date: Date) async throws {
        try failIfNeeded()
    }

    func syncHealth(_ metrics: [HealthMetricUpload]) async throws {
        try failIfNeeded()
    }

    func syncCalendar(_ events: [CalendarEventUpload]) async throws {
        try failIfNeeded()
    }

    func addFinanceAccount(_ request: FinanceAccountUpload) async throws -> LifeFinanceAccount {
        try failIfNeeded()
        return LifeFinanceAccount(
            id: UUID(),
            externalId: request.externalId,
            name: request.name,
            institution: request.institution,
            type: request.type,
            balance: request.balance,
            currency: request.currency,
            source: request.source,
            lastSyncedAt: request.lastSyncedAt,
            createdAt: .now,
            updatedAt: .now
        )
    }

    func addFinanceTransaction(_ transaction: FinanceTransactionUpload) async throws {
        try failIfNeeded()
    }

    func uploadFile(data: Data, name: String, mimeType: String) async throws -> LifeVaultFile {
        try failIfNeeded()
        return LifeVaultFile(
            id: UUID(),
            name: name,
            mimeType: mimeType,
            sizeBytes: data.count,
            folder: "",
            tags: [],
            summary: "",
            createdAt: .now,
            updatedAt: .now
        )
    }

    func downloadFile(id: UUID) async throws -> Data {
        try failIfNeeded()
        return Data()
    }

    func deleteFile(id: UUID) async throws {
        try failIfNeeded()
    }

    private func failIfNeeded() throws {
        if shouldFail {
            throw URLError(.notConnectedToInternet)
        }
    }
}
