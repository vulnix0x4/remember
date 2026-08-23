import Foundation
import Observation

@Observable @MainActor
final class AppStore {
    private let repository: any ImprintRepository
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
            signInError = "That email or password did not work."
        }
    }

    func signOut() async {
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
        } catch {
            errorMessage = error.localizedDescription
            errorIsPresented = true
        }
    }

    func capture(_ url: URL) async {
        if imprints.contains(where: { $0.url == url }) {
            captureConfirmation = true
            return
        }
        do {
            let imprint = try await repository.capture(url)
            imprints.insert(imprint, at: 0)
            captureConfirmation = true
        } catch {
            errorMessage = error.localizedDescription
            errorIsPresented = true
        }
    }

    func importSharedURLs() async {
        for url in SharedCapture.drain() { await capture(url) }
    }

    func imprint(withID id: UUID) -> Imprint? { imprints.first(where: { $0.id == id }) }

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
        } catch {
            errorMessage = "Remember couldn’t restart this analysis. Please try again."
            errorIsPresented = true
        }
    }

    func answer(_ question: String) async -> AskAnswer? {
        do {
            return try await repository.ask(question)
        } catch {
            errorMessage = error.localizedDescription
            errorIsPresented = true
            return nil
        }
    }
}
