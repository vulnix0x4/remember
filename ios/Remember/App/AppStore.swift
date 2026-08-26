import Foundation
import Observation

@Observable @MainActor
final class AppStore {
    private let repository: any ImprintRepository
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

    init(repository: any ImprintRepository, selectedTab: AppTab = .home) {
        self.repository = repository
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

    func refreshAfterActivation() async {
        guard isAuthenticated else { return }
        do {
            imprints = try await repository.load()
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
}
