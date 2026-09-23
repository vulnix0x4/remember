import Foundation

struct LivingThread: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let saves: [Imprint]
    let earliest: Imprint
    let latest: Imprint
    let turningPoints: [LivingThreadTurningPoint]
    let pulse: LivingThreadPulse
    let question: String
}

struct LivingThreadTurningPoint: Identifiable, Hashable, Sendable {
    let id: String
    let imprint: Imprint
    let response: MemoryReflection
    let occurredAt: String

    var label: String {
        switch response {
        case .stillTrue: "You reaffirmed this"
        case .changedMind: "Your view shifted here"
        case .notSure: "You left this open"
        case .noLongerRelevant: "You let this go"
        }
    }

    var detail: String {
        switch response {
        case .stillTrue: "It still felt true when it came back."
        case .changedMind: "You saw this differently when it returned."
        case .notSure: "You were not ready to settle it yet."
        case .noLongerRelevant: "You decided this no longer belongs."
        }
    }
}

struct LivingThreadPulse: Hashable, Sendable {
    enum Kind: String, Hashable, Sendable {
        case unread, held, shifting, open, released
    }

    let kind: Kind
    let label: String
    let detail: String

    var systemImage: String {
        switch kind {
        case .held: "checkmark.circle"
        case .shifting: "arrow.trianglehead.2.clockwise.rotate.90"
        case .released: "minus.circle"
        case .open, .unread: "questionmark.circle"
        }
    }
}
