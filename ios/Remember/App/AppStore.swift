import Foundation
import Observation

@Observable @MainActor
final class AppStore {
    private let repository: any ImprintRepository
    private let lifeRepository: any LifeOSRepository
    @ObservationIgnored private var processingRefreshTask: Task<Void, Never>?
    @ObservationIgnored private var reflectionRevision = 0
    @ObservationIgnored private var returnFeedbackRevision = 0
    @ObservationIgnored private var evolutionRequestID: UUID?
    var imprints: [Imprint] = []
    var isLoading = false
    var errorMessage: String?
    var errorIsPresented = false
    var selectedTab: AppTab
    var captureIsPresented = false
    var isCheckingAuthentication = true
    var isAuthenticated = false
    var isSigningIn = false
    var signInError: String?
    var askDraft: String?
    var lastAskedQuestion: EvolutionRecentQuestion?
    var evolutionOverview = EvolutionOverview.empty
    var isLoadingEvolution = false
    var evolutionLoadFailed = false
    var resurfacedItemID: UUID?
    var lifeSnapshot = LifeSnapshot.empty
    var brain: BrainState?
    var isUpdatingBrain = false
    var brainError: String?
    var isLoadingLife = false
    var isSyncingHealth = false
    var isSyncingCalendar = false
    var lastHealthSync: Date?
    var lastCalendarSync: Date?

    /// One ordering for Today and Plan, so they never recommend different tasks.
    var queuedLifeTasks: [LifeTask] {
        let open = lifeSnapshot.tasks.filter { $0.status == .queued || $0.status == .inbox }
        let planned = brain?.settings.enabled == true
            ? (brain?.plan ?? []).sorted { $0.startAt < $1.startAt }
            : []
        let positions = planned.enumerated().reduce(into: [UUID: Int]()) { result, entry in
            if result[entry.element.taskId] == nil {
                result[entry.element.taskId] = entry.offset
            }
        }
        return open.sorted { left, right in
            let leftPosition = positions[left.id] ?? Int.max
            let rightPosition = positions[right.id] ?? Int.max
            if leftPosition != rightPosition { return leftPosition < rightPosition }
            if left.priority != right.priority {
                return taskPriorityRank(left.priority) > taskPriorityRank(right.priority)
            }
            return left.createdAt < right.createdAt
        }
    }

    var suggestedLifeTask: LifeTask? {
        queuedLifeTasks.first {
            ($0.notBefore ?? .distantPast) <= .now &&
            ($0.scheduledStart ?? .distantPast) <= .now
        }
    }

    func firstStep(for task: LifeTask) -> String {
        if !task.firstStep.isEmpty { return task.firstStep }
        if brain?.settings.enabled == true,
           let planned = brain?.plan.first(where: { $0.taskId == task.id }),
           !planned.firstStep.isEmpty {
            return planned.firstStep
        }
        return ""
    }

    private func taskPriorityRank(_ priority: LifeTaskPriority) -> Int {
        switch priority {
        case .must: 3
        case .high: 2
        case .normal: 1
        case .low: 0
        }
    }

    init(repository: any ImprintRepository, lifeRepository: any LifeOSRepository, selectedTab: AppTab = .home) {
        self.repository = repository
        self.lifeRepository = lifeRepository
        self.selectedTab = selectedTab
    }

    var resurfaced: Imprint? {
        guard let resurfacedItemID, let imprint = imprint(withID: resurfacedItemID) else { return nil }
        let eligibility = ReturnEligibility(
            reflections: evolutionOverview.reflections,
            returnFeedback: evolutionOverview.returnFeedback,
            tasks: lifeSnapshot.tasks
        )
        return eligibility.allows(imprint) ? imprint : nil
    }

    func bootstrap() async {
        isCheckingAuthentication = true
        isAuthenticated = await repository.hasSession()
        isCheckingAuthentication = false
        if isAuthenticated { await load() }
    }

    func signIn(email: String, password: String) async {
        guard !isSigningIn else { return }
        isSigningIn = true
        signInError = nil
        defer { isSigningIn = false }
        do {
            try await repository.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            isAuthenticated = true
            await load()
        } catch {
            if (error as? APIError)?.statusCode == 401 {
                signInError = "That email or password did not work."
            } else {
                signInError = "Remember could not reach your private library. Check your connection and try again."
            }
        }
    }

    private var brainSessionID = UUID()

    func signOut() async {
        brainSessionID = UUID()
        processingRefreshTask?.cancel()
        processingRefreshTask = nil
        evolutionRequestID = nil
        isLoadingEvolution = false
        await repository.logout()
        imprints = []
        evolutionOverview = .empty
        resurfacedItemID = nil
        lifeSnapshot = .empty
        brain = nil
        brainError = nil
        lastAskedQuestion = nil
        askDraft = nil
        isAuthenticated = false
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            imprints = try await repository.load()
            await importSharedURLs()
            await loadDerivedData()
            await loadLife()
            startProcessingRefreshIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
            errorIsPresented = true
        }
    }

    @discardableResult
    func capture(
        _ url: URL,
        personalReaction: String? = nil,
        returnCue: ReturnCue? = nil,
        returnAt: Date? = nil
    ) async throws -> Imprint {
        if let existing = imprints.first(where: { $0.url == url }) {
            return existing
        }
        let imprint = try await repository.capture(url, personalReaction: personalReaction, returnCue: returnCue, returnAt: returnAt)
        if let index = imprints.firstIndex(where: { $0.id == imprint.id || $0.url == imprint.url }) {
            imprints[index] = imprint
        } else {
            imprints.insert(imprint, at: 0)
        }
        startProcessingRefreshIfNeeded()
        return imprint
    }

    @discardableResult
    func captureThought(
        _ thought: String,
        returnCue: ReturnCue? = nil,
        returnAt: Date? = nil
    ) async throws -> Imprint {
        let imprint = try await repository.captureThought(
            thought,
            returnCue: returnCue,
            returnAt: returnAt
        )
        if let index = imprints.firstIndex(where: { $0.id == imprint.id }) {
            imprints[index] = imprint
        } else {
            imprints.insert(imprint, at: 0)
        }
        startProcessingRefreshIfNeeded()
        return imprint
    }

    func setReturnCue(for imprint: Imprint, cue: ReturnCue?, returnAt: Date?) async throws {
        let updated = try await repository.updateReturnCue(imprint, cue: cue, returnAt: returnAt)
        if let index = imprints.firstIndex(where: { $0.id == updated.id }) {
            imprints[index] = updated
        }
    }

    func importSharedURLs() async {
        for url in SharedCapture.pendingURLs() {
            do {
                try await capture(url)
                SharedCapture.acknowledge(url)
            } catch {
                let sourceName = url.host() ?? "this link"
                errorMessage = "Remember could not save \(sourceName). \(error.localizedDescription)"
                errorIsPresented = true
            }
        }
    }

    func imprint(withID id: UUID) -> Imprint? { imprints.first(where: { $0.id == id }) }

    func loadDetail(_ imprint: Imprint) async {
        do {
            let detailed = try await repository.loadDetail(imprint)
            if let index = imprints.firstIndex(where: { $0.id == detailed.id }) {
                imprints[index] = detailed
            }
        } catch {
            // The list item still contains the source URL and last known analysis.
        }
    }

    func setPrincipleStatus(for imprint: Imprint, status: String) async throws {
        guard let principleID = imprint.principleID else { return }
        try await repository.updatePrinciple(id: principleID, status: status)
        guard let index = imprints.firstIndex(where: { $0.id == imprint.id }) else { return }
        imprints[index].principleStatus = status
        if let principleIndex = evolutionOverview.principles.firstIndex(where: { $0.id.lowercased() == principleID.uuidString.lowercased() }) {
            evolutionOverview.principles[principleIndex].status = status
        }
    }

    func setPrincipleStatus(_ principle: EvolutionPrinciple, status: String) async throws {
        guard let principleID = UUID(uuidString: principle.id) else { return }
        try await repository.updatePrinciple(id: principleID, status: status)
        if let principleIndex = evolutionOverview.principles.firstIndex(where: { $0.id == principle.id }) {
            evolutionOverview.principles[principleIndex].status = status
        }
        if let imprintID = UUID(uuidString: principle.itemId),
           let imprintIndex = imprints.firstIndex(where: { $0.id == imprintID }) {
            imprints[imprintIndex].principleID = principleID
            imprints[imprintIndex].principleStatus = status
        }
    }

    @discardableResult
    func reflectOnMemory(_ imprint: Imprint, response: MemoryReflection) async -> Bool {
        do {
            try await repository.reflectOnMemory(itemID: imprint.id, response: response)
            evolutionOverview.reflections.insert(
                EvolutionReflection(
                    id: UUID().uuidString.lowercased(),
                    itemId: imprint.id.uuidString.lowercased(),
                    response: response.rawValue,
                    occurredAt: Date.now.formatted(.iso8601)
                ),
                at: 0
            )
            reflectionRevision += 1
            return true
        } catch {
            return false
        }
    }

    func loadDerivedData() async {
        let requestID = UUID()
        evolutionRequestID = requestID
        isLoadingEvolution = true
        evolutionLoadFailed = false
        let startingReflectionRevision = reflectionRevision
        let startingFeedbackRevision = returnFeedbackRevision
        do {
            var overview = try await repository.loadEvolution()
            guard evolutionRequestID == requestID else { return }
            // An older snapshot must not undo a decision confirmed while it
            // was loading. The next refresh can reconcile its server history.
            if reflectionRevision != startingReflectionRevision {
                overview.reflections = evolutionOverview.reflections
            }
            if returnFeedbackRevision != startingFeedbackRevision {
                overview.returnFeedback = evolutionOverview.returnFeedback
            }
            evolutionOverview = overview
        } catch {
            guard evolutionRequestID == requestID else { return }
            evolutionLoadFailed = true
        }
        isLoadingEvolution = false

        do {
            let itemID = try await repository.loadResurfacedItemID()
            guard evolutionRequestID == requestID else { return }
            resurfacedItemID = itemID
        } catch {
            guard evolutionRequestID == requestID else { return }
            resurfacedItemID = nil
        }
    }

    func retry(_ imprint: Imprint) async {
        do {
            let queued = try await repository.retry(imprint)
            guard let index = imprints.firstIndex(where: { $0.id == queued.id }) else {
                imprints.insert(queued, at: 0)
                return
            }
            imprints[index] = queued
            startProcessingRefreshIfNeeded()
        } catch {
            errorMessage = "Remember couldn’t restart this analysis. Please try again."
            errorIsPresented = true
        }
    }

    func answer(_ question: String) async throws -> AskAnswer {
        lastAskedQuestion = EvolutionRecentQuestion(question: question, askedAt: Date.now.formatted(.iso8601))
        return try await repository.ask(question)
    }

    @discardableResult
    func rateContextualReturn(_ imprint: Imprint, response: ContextualReturnFeedbackResponse) async -> Bool {
        do {
            try await repository.rateContextualReturn(itemID: imprint.id, response: response)
            evolutionOverview.returnFeedback.insert(
                EvolutionReturnFeedback(
                    id: UUID().uuidString.lowercased(),
                    itemId: imprint.id.uuidString.lowercased(),
                    response: response.rawValue,
                    occurredAt: Date.now.formatted(.iso8601)
                ),
                at: 0
            )
            returnFeedbackRevision += 1
            return true
        } catch {
            return false
        }
    }

    func thinkThroughDecision(_ decision: String, context: String) async throws -> DecisionBrief {
        try await repository.thinkThroughDecision(decision, context: context)
    }

    func resetAskConversation() async {
        await repository.resetAskConversation()
    }

    func loadLife() async {
        isLoadingLife = true
        defer { isLoadingLife = false }
        do {
            lifeSnapshot = try await lifeRepository.load()
            Task { await refreshBrain() }
        }
        catch {
            errorMessage = "Your life dashboard could not refresh. The last loaded data is still visible."
            errorIsPresented = true
        }
    }

    func decideNextMove(_ input: EverydayDecisionRequest) async throws -> EverydayDecision {
        let decision = try await lifeRepository.decideNextMove(input)
        if decision.focusStarted { await loadLife() }
        return decision
    }

    @discardableResult
    func refreshBrain(settings: BrainSettings? = nil) async -> Bool {
        guard !isUpdatingBrain, isAuthenticated else { return false }
        let sessionID = brainSessionID
        isUpdatingBrain = true
        defer { isUpdatingBrain = false }
        do {
            let updated = try await lifeRepository.syncBrain(settings: settings)
            guard isAuthenticated, sessionID == brainSessionID else { return false }
            brain = updated
            brainError = nil
            if updated?.status == "ready" {
                let snapshot = try await lifeRepository.load()
                guard isAuthenticated, sessionID == brainSessionID else { return false }
                lifeSnapshot = snapshot
            }
            return true
        } catch {
            if isAuthenticated, sessionID == brainSessionID { brainError = "Your automatic plan could not sync. Your tasks are safe; Jev will retry." }
            return false
        }
    }

    @discardableResult
    func createLifeTask(title: String, firstStep: String, notes: String = "", area: LifeArea, duration: Int, priority: LifeTaskPriority = .normal, goalId: UUID? = nil, source: String = "manual", sourceItemId: UUID? = nil, repeatEveryDays: Int? = nil) async -> Bool {
        do {
            _ = try await lifeRepository.createTask(CreateLifeTaskRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                firstStep: firstStep.trimmingCharacters(in: .whitespacesAndNewlines),
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines), area: area, status: .queued, priority: priority, energy: .any,
                durationMinutes: duration, goalId: goalId, source: source, sourceItemId: sourceItemId, repeatEveryDays: repeatEveryDays
            ))
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    func activateLifeTask(_ id: UUID) async {
        do { try await lifeRepository.activateTask(id: id); await loadLife() }
        catch { presentLifeError("Remember could not make that your current task.") }
    }

    @discardableResult
    func completeLifeTask(_ id: UUID, minutesSpent: Int, result: PracticeResult? = nil) async -> Bool {
        do {
            try await lifeRepository.completeTask(id: id, minutesSpent: minutesSpent, result: result)
            await loadLife()
            return true
        } catch {
            presentLifeError("That completion could not be saved.")
            return false
        }
    }

    @discardableResult
    func reflectOnPractice(_ id: UUID, result: PracticeResult) async -> Bool {
        do {
            try await lifeRepository.reflectOnPractice(id: id, result: result)
            await loadLife()
            return true
        } catch {
            presentLifeError("That result could not be saved.")
            return false
        }
    }

    @discardableResult
    func blockLifeTask(_ id: UUID, reason: LifeBlockerReason) async -> Bool {
        do {
            try await lifeRepository.blockTask(id: id, reason: reason)
            await loadLife()
            return true
        } catch {
            presentLifeError("Remember could not adjust that task.")
            return false
        }
    }

    @discardableResult
    func createLifeGoal(title: String, area: LifeArea, why: String) async -> Bool {
        do {
            _ = try await lifeRepository.createGoal(CreateLifeGoalRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                area: area,
                vision: "",
                why: why.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    @discardableResult
    func createLifeFloorItem(title: String, area: LifeArea, target: Int, unit: String) async -> Bool {
        do {
            _ = try await lifeRepository.createFloorItem(CreateLifeFloorRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                area: area,
                target: target,
                unit: unit.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    func toggleLifeFloorItem(_ id: UUID) async {
        var components = Calendar.current.dateComponents([.year, .month, .day], from: .now)
        components.hour = 12
        let date = Calendar.current.date(from: components) ?? .now
        do { try await lifeRepository.toggleFloorItem(id: id, date: date); await loadLife() }
        catch { presentLifeError("Remember could not update that daily basic.") }
    }

    func syncHealth(_ metrics: [HealthMetricUpload]) async {
        isSyncingHealth = true
        defer { isSyncingHealth = false }
        do {
            try await lifeRepository.syncHealth(metrics)
            lastHealthSync = .now
            await loadLife()
        } catch { presentLifeError("Apple Health could not sync. Check Health permissions and try again.") }
    }

    func syncCalendar(_ events: [CalendarEventUpload]) async {
        isSyncingCalendar = true
        defer { isSyncingCalendar = false }
        do {
            try await lifeRepository.syncCalendar(events)
            lastCalendarSync = .now
            await loadLife()
        } catch { presentLifeError("Calendar could not sync. Check Calendar permissions and try again.") }
    }

    @discardableResult
    func addFinanceAccount(name: String, institution: String, type: String, balance: Double, currency: String = "USD") async -> Bool {
        do {
            _ = try await lifeRepository.addFinanceAccount(FinanceAccountUpload(
                externalId: UUID().uuidString,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                institution: institution.trimmingCharacters(in: .whitespacesAndNewlines),
                type: type,
                balance: balance,
                currency: currency.uppercased(),
                source: "manual",
                lastSyncedAt: .now
            ))
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    @discardableResult
    func addFinanceTransaction(accountId: UUID?, name: String, amount: Double, category: String, currency: String = "USD") async -> Bool {
        do {
            let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
            try await lifeRepository.addFinanceTransaction(FinanceTransactionUpload(
                accountId: accountId,
                externalId: UUID().uuidString,
                name: trimmedName,
                merchant: trimmedName,
                amount: amount,
                currency: currency.uppercased(),
                category: trimmedCategory.isEmpty ? "Uncategorized" : trimmedCategory,
                occurredAt: .now,
                status: "posted",
                notes: ""
            ))
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    @discardableResult
    func uploadLifeFile(data: Data, name: String, mimeType: String) async -> Bool {
        do {
            _ = try await lifeRepository.uploadFile(data: data, name: name, mimeType: mimeType)
            await loadLife()
            return true
        } catch {
            return false
        }
    }

    func downloadLifeFile(_ file: LifeVaultFile) async throws -> Data {
        try await lifeRepository.downloadFile(id: file.id)
    }

    func deleteLifeFile(_ file: LifeVaultFile) async {
        do {
            try await lifeRepository.deleteFile(id: file.id)
            lifeSnapshot.files.removeAll { $0.id == file.id }
        } catch {
            presentLifeError("That file could not be deleted.")
        }
    }

    func refreshAfterActivation() async {
        guard isAuthenticated else { return }
        do {
            imprints = try await repository.load()
            lifeSnapshot = (try? await lifeRepository.load()) ?? lifeSnapshot
            await importSharedURLs()
            startProcessingRefreshIfNeeded()
        } catch {
            // Keep the last known library visible when a foreground refresh fails.
        }
    }

    private func startProcessingRefreshIfNeeded() {
        guard isAuthenticated, imprints.contains(where: { $0.state == .processing }) else {
            processingRefreshTask?.cancel()
            processingRefreshTask = nil
            return
        }
        guard processingRefreshTask == nil else { return }
        processingRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(4)) } catch { break }
                guard let self, self.isAuthenticated else { break }
                do {
                    self.imprints = try await self.repository.load()
                } catch {
                    continue
                }
                if !self.imprints.contains(where: { $0.state == .processing }) { break }
            }
            self?.processingRefreshTask = nil
        }
    }

    private func presentLifeError(_ message: String) {
        errorMessage = message
        errorIsPresented = true
    }
}
