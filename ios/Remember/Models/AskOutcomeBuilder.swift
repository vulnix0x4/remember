import Foundation

enum AskOutcomeBuilder {
    static func build(for message: AskMessage, imprints: [Imprint]) -> AskOutcome? {
        guard message.role == .assistant, message.grounded == true else { return nil }
        for citation in message.citations {
            guard let imprint = imprints.first(where: { $0.id == citation.itemID }) else { continue }
            let experiment = imprint.experiments.first
            let principle = imprint.candidatePrinciples.first
            if experiment != nil || principle != nil {
                return AskOutcome(imprint: imprint, experiment: experiment, principle: principle)
            }
        }
        return nil
    }
}
