import Foundation
import Observation

@Observable @MainActor
final class AskViewModel {
    var input = ""
    var messages: [AskMessage] = []
    var isResponding = false
    var failureTitle: String?
    var failureMessage: String?
    private var failedQuestion: String?

    func ask(using store: AppStore) async {
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        input = ""
        await perform(question, appendQuestion: true, using: store)
    }

    func retry(using store: AppStore) async {
        guard let failedQuestion else { return }
        await perform(failedQuestion, appendQuestion: false, using: store)
    }

    private func perform(_ question: String, appendQuestion: Bool, using store: AppStore) async {
        guard !isResponding else { return }
        if appendQuestion {
            messages.append(AskMessage(id: UUID(), role: .user, text: question, citations: [], grounded: nil, limitations: []))
        }
        failedQuestion = nil
        failureTitle = nil
        failureMessage = nil
        isResponding = true
        defer { isResponding = false }
        do {
            let answer = try await store.answer(question)
            messages.append(
                AskMessage(
                    id: UUID(),
                    role: .assistant,
                    text: answer.text,
                    citations: answer.citations,
                    grounded: answer.grounded,
                    limitations: answer.limitations
                )
            )
        } catch {
            failedQuestion = question
            let copy = Self.failureCopy(for: error)
            failureTitle = copy.title
            failureMessage = copy.message
        }
    }

    private static func failureCopy(for error: Error) -> (title: String, message: String) {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut:
                return ("Answer took too long", "Your question is still here. Try again and Remember will keep using only your saved sources.")
            case .notConnectedToInternet, .networkConnectionLost:
                return ("You appear to be offline", "Reconnect, then try this question again.")
            default:
                break
            }
        }
        return ("Could not answer that", "Your question was not lost. Try again in a moment.")
    }
}
