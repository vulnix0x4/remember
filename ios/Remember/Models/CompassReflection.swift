import Foundation

struct CompassReflection: Identifiable, Hashable, Sendable {
    let reflection: EvolutionReflection
    let imprint: Imprint?
    let statement: String

    var id: String { reflection.id }
}
