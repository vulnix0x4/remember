import Foundation

struct ContextualReturn: Hashable, Sendable {
    let imprint: Imprint
    let contextKind: ContextualReturnKind
    let contextTitle: String
    let contextArea: LifeArea
    let contextDetail: String?
    let connection: String
    let reason: String
    let question: String
    let livedResult: PracticeOutcome?
    let suggestedAction: ContextualReturnAction?
}

struct ContextualReturnAction: Hashable, Sendable {
    let title: String
    let firstStep: String
    let durationMinutes: Int
}
