import Foundation

struct CompassExperiment: Identifiable, Hashable, Sendable {
    let task: LifeTask
    let imprint: Imprint?

    var id: UUID { task.id }
}
