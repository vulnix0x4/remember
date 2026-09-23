import Foundation

struct PersonalCompass: Hashable, Sendable {
    let guidance: [CompassGuidance]
    let truths: [EvolutionPrinciple]
    let suggestions: [EvolutionPrinciple]
    let activeExperiments: [CompassExperiment]
    let completedExperiments: [CompassExperiment]
    let changes: [CompassReflection]
    let tension: EvolutionTension?
}
