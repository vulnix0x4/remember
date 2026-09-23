import Foundation

protocol LifeOSRepository: Sendable {
    func syncBrain(settings: BrainSettings?) async throws -> BrainState?
    func decideNextMove(_ input: EverydayDecisionRequest) async throws -> EverydayDecision
    func load() async throws -> LifeSnapshot
    func createTask(_ task: CreateLifeTaskRequest) async throws -> LifeTask
    func activateTask(id: UUID) async throws
    func completeTask(id: UUID, minutesSpent: Int, result: PracticeResult?) async throws
    func reflectOnPractice(id: UUID, result: PracticeResult) async throws
    func blockTask(id: UUID, reason: LifeBlockerReason) async throws
    func createGoal(_ goal: CreateLifeGoalRequest) async throws -> LifeGoal
    func createFloorItem(_ item: CreateLifeFloorRequest) async throws -> LifeFloorItem
    func toggleFloorItem(id: UUID, date: Date) async throws
    func syncHealth(_ metrics: [HealthMetricUpload]) async throws
    func syncCalendar(_ events: [CalendarEventUpload]) async throws
    func addFinanceAccount(_ account: FinanceAccountUpload) async throws -> LifeFinanceAccount
    func addFinanceTransaction(_ transaction: FinanceTransactionUpload) async throws
    func uploadFile(data: Data, name: String, mimeType: String) async throws -> LifeVaultFile
    func downloadFile(id: UUID) async throws -> Data
    func deleteFile(id: UUID) async throws
}

extension LifeOSRepository {
    func syncBrain(settings: BrainSettings?) async throws -> BrainState? { nil }
    func decideNextMove(_ input: EverydayDecisionRequest) async throws -> EverydayDecision {
        throw APIError.response(status: 503, code: "jev_not_configured", message: "Connect your Remember server and its OpenRouter key to let Jev decide.", requestID: nil)
    }
}

actor LiveLifeOSRepository: LifeOSRepository {
    private let client: APIClient
    private let usesMockFallback: Bool
    private var mockSnapshot = FixtureLibrary.lifeSnapshot

    init(client: APIClient, usesMockFallback: Bool = false) {
        self.client = client
        self.usesMockFallback = usesMockFallback
    }

    func decideNextMove(_ input: EverydayDecisionRequest) async throws -> EverydayDecision {
        // Never present fixture choices as Jev decisions, even in preview mode.
        try await client.decideNextMove(input)
    }

    func syncBrain(settings: BrainSettings?) async throws -> BrainState? {
        try await client.syncBrain(settings: settings)
    }

    func load() async throws -> LifeSnapshot {
        do {
            let snapshot = try await client.fetchLifeSnapshot()
            mockSnapshot = snapshot
            return snapshot
        }
        catch where usesMockFallback { return mockSnapshot }
    }

    func createTask(_ request: CreateLifeTaskRequest) async throws -> LifeTask {
        do { return try await client.createLifeTask(request) }
        catch where usesMockFallback {
            let timestamp = Date.now
            var status = request.status
            if status == .queued && !mockSnapshot.tasks.contains(where: { $0.status == .active }) { status = .active }
            if status == .active {
                mockSnapshot.tasks = mockSnapshot.tasks.map { task in
                    var task = task
                    if task.status == .active { task.status = .queued }
                    return task
                }
            }
            let task = LifeTask(
                id: UUID(), goalId: request.goalId, title: request.title, firstStep: request.firstStep,
                notes: request.notes, area: request.area, status: status, priority: request.priority,
                energy: request.energy, durationMinutes: request.durationMinutes, dueAt: nil,
                scheduledStart: nil, scheduledEnd: nil, source: request.source, sourceItemId: request.sourceItemId, completedAt: nil,
                createdAt: timestamp, updatedAt: timestamp
            )
            mockSnapshot.tasks.insert(task, at: 0)
            return task
        }
    }

    func activateTask(id: UUID) async throws {
        do { _ = try await client.updateLifeTask(id: id, status: .active) }
        catch where usesMockFallback {
            mockSnapshot.tasks = mockSnapshot.tasks.map { task in
                var task = task
                if task.id == id { task.status = .active }
                else if task.status == .active { task.status = .queued }
                return task
            }
        }
    }

    func completeTask(id: UUID, minutesSpent: Int, result: PracticeResult?) async throws {
        do { try await client.completeLifeTask(id: id, minutesSpent: minutesSpent, result: result) }
        catch where usesMockFallback {
            guard let index = mockSnapshot.tasks.firstIndex(where: { $0.id == id }) else { return }
            mockSnapshot.tasks[index].status = .done
            mockSnapshot.tasks[index].completedAt = .now
            if let result {
                mockSnapshot.tasks[index].practiceOutcome = result.outcome
                mockSnapshot.tasks[index].practiceReflection = result.reflection
                mockSnapshot.tasks[index].reflectedAt = .now
            }
            if let next = mockSnapshot.tasks.indices.first(where: { mockSnapshot.tasks[$0].status == .queued || mockSnapshot.tasks[$0].status == .inbox }) {
                mockSnapshot.tasks[next].status = .active
            }
        }
    }

    func reflectOnPractice(id: UUID, result: PracticeResult) async throws {
        do { _ = try await client.reflectOnPractice(id: id, result: result) }
        catch where usesMockFallback {
            guard let index = mockSnapshot.tasks.firstIndex(where: { $0.id == id }) else { return }
            mockSnapshot.tasks[index].practiceOutcome = result.outcome
            mockSnapshot.tasks[index].practiceReflection = result.reflection
            mockSnapshot.tasks[index].reflectedAt = .now
        }
    }

    func blockTask(id: UUID, reason: LifeBlockerReason) async throws {
        do { try await client.blockLifeTask(id: id, reason: reason) }
        catch where usesMockFallback {
            guard let index = mockSnapshot.tasks.firstIndex(where: { $0.id == id }) else { return }
            let task = mockSnapshot.tasks[index]
            mockSnapshot.blockers.insert(LifeBlockerEvent(id: UUID(), taskId: id, taskTitle: task.title, reason: reason, originalDuration: task.durationMinutes, createdAt: .now), at: 0)
            switch reason {
            case .big:
                mockSnapshot.tasks[index].title = task.firstStep.isEmpty ? task.title : task.firstStep
                mockSnapshot.tasks[index].firstStep = "Open what you need and begin for two minutes. Stopping after that still counts as starting."
                mockSnapshot.tasks[index].durationMinutes = max(2, min(5, Int(ceil(Double(task.durationMinutes) / 3))))
            case .unclear:
                mockSnapshot.tasks[index].firstStep = "Write the first visible action in one sentence. Then do only that sentence."
                mockSnapshot.tasks[index].durationMinutes = min(5, task.durationMinutes)
            case .time:
                mockSnapshot.tasks[index].firstStep = "Set a five-minute boundary and finish the smallest useful piece."
                mockSnapshot.tasks[index].durationMinutes = min(5, task.durationMinutes)
            case .place:
                mockSnapshot.tasks[index].firstStep = "Choose the smallest version that works where you are now."
                mockSnapshot.tasks[index].durationMinutes = min(10, task.durationMinutes)
            case .irrelevant:
                mockSnapshot.tasks[index].status = .removed
            case .different:
                mockSnapshot.tasks[index].status = .queued
                mockSnapshot.tasks[index].notBefore = .now.addingTimeInterval(3600)
            }
        }
    }

    func createGoal(_ request: CreateLifeGoalRequest) async throws -> LifeGoal {
        do { return try await client.createLifeGoal(request) }
        catch where usesMockFallback {
            let timestamp = Date.now
            let goal = LifeGoal(id: UUID(), title: request.title, area: request.area, vision: request.vision, why: request.why, status: "active", progress: 0, targetDate: nil, createdAt: timestamp, updatedAt: timestamp)
            mockSnapshot.goals.insert(goal, at: 0)
            return goal
        }
    }

    func createFloorItem(_ request: CreateLifeFloorRequest) async throws -> LifeFloorItem {
        do { return try await client.createLifeFloorItem(request) }
        catch where usesMockFallback {
            let timestamp = Date.now
            let item = LifeFloorItem(id: UUID(), title: request.title, area: request.area, target: request.target, unit: request.unit, completionDates: [], createdAt: timestamp, updatedAt: timestamp)
            mockSnapshot.floor.append(item)
            return item
        }
    }

    func toggleFloorItem(id: UUID, date: Date) async throws {
        do { _ = try await client.toggleLifeFloorItem(id: id, date: date) }
        catch where usesMockFallback {
            guard let index = mockSnapshot.floor.firstIndex(where: { $0.id == id }) else { return }
            if let existing = mockSnapshot.floor[index].completionDates.firstIndex(where: { Calendar.current.isDate($0, inSameDayAs: date) }) {
                mockSnapshot.floor[index].completionDates.remove(at: existing)
            } else {
                mockSnapshot.floor[index].completionDates.append(date)
            }
            mockSnapshot.floor[index].updatedAt = .now
        }
    }

    func syncHealth(_ metrics: [HealthMetricUpload]) async throws {
        do { try await client.syncHealthMetrics(metrics) }
        catch where usesMockFallback {
            let incoming = metrics.map { metric in
                LifeHealthMetric(id: UUID(), externalId: metric.externalId, type: metric.type, value: metric.value, unit: metric.unit, startAt: metric.startAt, endAt: metric.endAt, source: metric.source, metadata: metric.metadata, createdAt: .now)
            }
            let keys = Set(incoming.map { "\($0.source):\($0.externalId ?? "")" })
            mockSnapshot.health.removeAll { keys.contains("\($0.source):\($0.externalId ?? "")") }
            mockSnapshot.health.insert(contentsOf: incoming, at: 0)
        }
    }

    func syncCalendar(_ events: [CalendarEventUpload]) async throws {
        do { try await client.syncCalendarEvents(events) }
        catch where usesMockFallback {
            let incoming = events.map { event in
                LifeCalendarEvent(id: UUID(), externalId: event.externalId, source: event.source, calendarName: event.calendarName, title: event.title, notes: event.notes, location: event.location, url: event.url, startAt: event.startAt, endAt: event.endAt, allDay: event.allDay, status: event.status, createdAt: .now, updatedAt: .now)
            }
            let keys = Set(incoming.map { "\($0.source):\($0.externalId ?? "")" })
            mockSnapshot.events.removeAll { keys.contains("\($0.source):\($0.externalId ?? "")") }
            mockSnapshot.events.append(contentsOf: incoming)
            mockSnapshot.events.sort { $0.startAt < $1.startAt }
        }
    }

    func addFinanceAccount(_ request: FinanceAccountUpload) async throws -> LifeFinanceAccount {
        do { return try await client.addFinanceAccount(request) }
        catch where usesMockFallback {
            let timestamp = Date.now
            let account = LifeFinanceAccount(id: UUID(), externalId: request.externalId, name: request.name, institution: request.institution, type: request.type, balance: request.balance, currency: request.currency, source: request.source, lastSyncedAt: request.lastSyncedAt, createdAt: timestamp, updatedAt: timestamp)
            mockSnapshot.accounts.insert(account, at: 0)
            return account
        }
    }

    func addFinanceTransaction(_ request: FinanceTransactionUpload) async throws {
        do { try await client.addFinanceTransaction(request) }
        catch where usesMockFallback {
            let timestamp = Date.now
            mockSnapshot.transactions.insert(LifeFinanceTransaction(id: UUID(), accountId: request.accountId, externalId: request.externalId, name: request.name, merchant: request.merchant, amount: request.amount, currency: request.currency, category: request.category, occurredAt: request.occurredAt, status: request.status, notes: request.notes, createdAt: timestamp, updatedAt: timestamp), at: 0)
        }
    }

    func uploadFile(data: Data, name: String, mimeType: String) async throws -> LifeVaultFile {
        do { return try await client.uploadVaultFile(data: data, name: name, mimeType: mimeType) }
        catch where usesMockFallback {
            let timestamp = Date.now
            let file = LifeVaultFile(id: UUID(), name: name, mimeType: mimeType, sizeBytes: data.count, folder: "", tags: [], summary: "", createdAt: timestamp, updatedAt: timestamp)
            mockSnapshot.files.insert(file, at: 0)
            return file
        }
    }

    func downloadFile(id: UUID) async throws -> Data {
        do { return try await client.downloadVaultFile(id: id) }
        catch where usesMockFallback { return Data() }
    }

    func deleteFile(id: UUID) async throws {
        do { try await client.deleteVaultFile(id: id) }
        catch where usesMockFallback {
            mockSnapshot.files.removeAll { $0.id == id }
        }
    }
}
