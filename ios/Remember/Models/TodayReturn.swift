import Foundation

enum TodayReturn {
    case intentional(Imprint, ReturnCue)
    case contextual(ContextualReturn)
    case resurfaced(Imprint)

    var imprint: Imprint {
        switch self {
        case let .intentional(imprint, _), let .resurfaced(imprint): imprint
        case let .contextual(match): match.imprint
        }
    }

    var heading: String {
        switch self {
        case .intentional(_, .date): "You chose today"
        case .intentional, .contextual: "For right now"
        case .resurfaced: "Worth revisiting"
        }
    }
}
