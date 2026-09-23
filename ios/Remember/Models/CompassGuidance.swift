import Foundation

enum CompassGuidanceKind: Hashable, Sendable {
    case keep
    case adjust
    case release
}

struct CompassGuidance: Identifiable, Hashable, Sendable {
    let kind: CompassGuidanceKind
    let experiment: CompassExperiment
    let principle: EvolutionPrinciple?

    var id: UUID { experiment.id }
}
