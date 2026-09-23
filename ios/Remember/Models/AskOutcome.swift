import Foundation

struct AskOutcome: Hashable, Sendable {
    let imprint: Imprint
    let experiment: String?
    let principle: String?
}
