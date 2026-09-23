import Foundation

struct WeeklySynthesis: Hashable, Sendable {
    let headline: String
    let story: String
    let reflection: String?
    let theme: String?
    let experiment: CompassExperiment?
    let outcome: PracticeOutcome?
    let canCarryForward: Bool
}
