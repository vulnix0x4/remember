import Foundation
import Observation

@Observable @MainActor
final class AskViewModel {
    var input = ""
    var messages: [AskMessage] = []
    var isResponding = false

    func ask(using store: AppStore) async {
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        messages.append(AskMessage(id: UUID(), role: .user, text: question, citations: [], grounded: nil, limitations: []))
        input = ""
        isResponding = true
        if let answer = await store.answer(question) {
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
        }
        isResponding = false
    }
}
