import Foundation

struct APIBrainResponse: Decodable, Sendable {
    let brain: BrainState?
}
