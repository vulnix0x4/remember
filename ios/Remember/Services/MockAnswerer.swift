import Foundation

enum MockAnswerer {
    static func answer(_ question: String, imprints: [Imprint]) -> AskAnswer {
        let text: String
        if question.localizedStandardContains("contradict") || question.localizedStandardContains("disagree") {
            text = "Your saves hold a useful tension: one thread treats focus as deliberate exclusion, while another argues that an over-planned life loses its capacity for surprise. The pattern is not indecision. It is an attempt to find structure that still leaves room to notice."
        } else if question.localizedStandardContains("success") || question.localizedStandardContains("believe") {
            text = "Based only on what you have saved, success seems less connected to approval and more connected to authorship: protecting attention, choosing your response, and building a direction that still leaves space for uncertainty. This is an interpretation, not a fact about you."
        } else {
            text = "Across your saved material, identity and purpose recur most often. Several sources connect growth with choosing a response rather than controlling the past, while your more recent saves shift toward attention and building."
        }
        let citations = imprints.filter { $0.state == .ready }.prefix(3).map { imprint in
            Citation(
                id: UUID(), itemID: imprint.id, title: imprint.title, seconds: imprint.moments.first?.seconds,
                url: imprint.url, excerpt: imprint.essence
            )
        }
        return AskAnswer(text: text, citations: citations, grounded: true, limitations: ["Preview answer generated from deterministic fixtures."])
    }
}
