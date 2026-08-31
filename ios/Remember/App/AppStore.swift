import Foundation
import Observation

@Observable @MainActor
final class AppStore {
    private let repository: any ImprintRepository
    private let lifeRepository: any LifeOSRepository
    @ObservationIgnored private var processingRefreshTask: Task<Void, Never>?
    var imprints: [Imprint] = []
    var isLoading = false
    var errorMessage: String?
    var errorIsPresented = false
    var selectedTab: AppTab
    var captureIsPresented = false
    var captureConfirmation = false
    var isCheckingAuthentication = true
    var isAuthenticated = false
    var isSigningIn = false
    var signInError: String?
    var evolutionOverview = EvolutionOverview.empty
    var isLoadingEvolution = false
    var evolutionLoadFailed = false
    var resurfacedItemID: UUID?
    var lifeSnapshot = LifeSnapshot.empty
    var isLoadingLife = false
    var isSyncingHealth = false
    var isSyncingCalendar = false
    var lastHealthSync: Date?
    var lastCalendarSync: Date?

    init(repository: any ImprintRepository, lifeRepository: any LifeOSRepository, selectedTab: AppTab = .home) {
        self.repository = repository
        self.lifeRepository = lifeRepository
        self.selectedTab = selectedTab
    }

    var resurfaced: Imprint? {
        guard let resurfacedItemID else { return nil }
        return imprint(withID: resurfacedItemID)
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
            if case APIError.server(401) = error {
                signInError = "That email or password did not work."
            } else {
                signInError = "Remember could not reach your private library. Check your connection and try again."
            }
        }
    }

    func signOut() async {
        processingRefreshTask?.cancel()
        processingRefreshTask = nil
        await repository.logout()
        imprints = []
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
    func capture(_ url: URL) async throws -> Imprint {
        if let existing = imprints.first(where: { $0.url == url }) {
            captureConfirmation = true
            return existing
        }
        let imprint = try await repository.capture(url)
        if let index = imprints.firstIndex(where: { $0.id == imprint.id || $0.url == imprint.url }) {
            imprints[index] = imprint
        } else {
            imprints.insert(imprint, at: 0)
        }
        captureConfirmation = true
        startProcessingRefreshIfNeeded()
        return imprint
    }

    func importSharedURLs() async {
        for url in SharedCapture.drain() {
            do {
                try await capture(url)
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
    }

    func loadDerivedData() async {
        isLoadingEvolution = true
        evolutionLoadFailed = false
        do {
            evolutionOverview = try await repository.loadEvolution()
        } catch {
            evolutionOverview = .empty
            evolutionLoadFailed = true
        }
        isLoadingEvolution = false

        do {
            resurfacedItemID = try await repository.loadResurfacedItemID()
        } catch {
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
        try await repository.ask(question)
    }

    func loadLife() async {
        isLoadingLife = true
        defer { isLoadingLife = false }
        do { lifeSnapshot = try await lifeRepository.load() }
        catch {
            errorMessage = "Your life dashboard could not refresh. The last loaded data is still visible."
            errorIsPresented = true
        }
    }

    func createLifeTask(title: String, firstStep: String, area: LifeArea, duration: Int, priority: LifeTaskPriority = .normal, goalId: UUID? = nil, source: String = "manual") async {
        do {
            _ = try await lifeRepository.createTask(CreateLifeTaskRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                firstStep: firstStep.trimmingCharacters(in: .whitespacesAndNewlines),
                notes: "", area: area, status: .queued, priority: priority, energy: .any,
                durationMinutes: duration, goalId: goalId, source: source
            ))
            await loadLife()
        } catch { presentLifeError("That move could not be saved.") }
    }

    func activateLifeTask(_ id: UUID) async {
        do { try await lifeRepository.activateTask(id: id); await loadLife() }
        catch { presentLifeError("Remember could not make that your active move.") }
    }

    func completeLifeTask(_ id: UUID, minutesSpent: Int) async {
        do { try await lifeRepository.completeTask(id: id, minutesSpent: minutesSpent); await loadLife() }
        catch { presentLifeError("That completion could not be saved.") }
    }

    func blockLifeTask(_ id: UUID, reason: LifeBlockerReason) async {
        do { try await lifeRepository.blockTask(id: id, reason: reason); await loadLife() }
        catch { presentLifeError("Remember could not adapt that move.") }
    }

    func createLifeGoal(title: String, area: LifeArea, why: String) async {
        do {
            _ = try await lifeRepository.createGoal(CreateLifeGoalRequest(title: title, area: area, vision: "", why: why))
            await loadLife()
        } catch { presentLifeError("That goal could not be saved.") }
    }

    func createLifeFloorItem(title: String, area: LifeArea, target: Int, unit: String) async {
        do {
            _ = try await lifeRepository.createFloorItem(CreateLifeFloorRequest(title: title, area: area, target: target, unit: unit))
            await loadLife()
        } catch { presentLifeError("That Life Floor baseline could not be saved.") }
    }

    func toggleLifeFloorItem(_ id: UUID) async {
        var components = Calendar.current.dateComponents([.year, .month, .day], from: .now)
        components.hour = 12
        let date = Calendar.current.date(from: components) ?? .now
        do { try await lifeRepository.toggleFloorItem(id: id, date: date); await loadLife() }
        catch { presentLifeError("Remember could not update today’s Life Floor.") }
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

    func addFinanceAccount(name: String, institution: String, type: String, balance: Double) async {
        do {
            _ = try await lifeRepository.addFinanceAccount(FinanceAccountUpload(externalId: UUID().uuidString, name: name, institution: institution, type: type, balance: balance, currency: "USD", source: "manual", lastSyncedAt: .now))
            await loadLife()
        } catch { presentLifeError("That account could not be saved.") }
    }

    func addFinanceTransaction(accountId: UUID?, name: String, amount: Double, category: String) async {
        do {
            try await lifeRepository.addFinanceTransaction(FinanceTransactionUpload(accountId: accountId, externalId: UUID().uuidString, name: name, merchant: name, amount: amount, currency: "USD", category: category, occurredAt: .now, status: "posted", notes: ""))
            await loadLife()
        } catch { presentLifeError("That transaction could not be saved.") }
    }

    func uploadLifeFile(data: Data, name: String, mimeType: String) async {
        do { _ = try await lifeRepository.uploadFile(data: data, name: name, mimeType: mimeType); await loadLife() }
        catch { presentLifeError(data.count > 25 * 1_024 * 1_024 ? "Files must be 25 MB or smaller." : "That file could not be uploaded.") }
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
