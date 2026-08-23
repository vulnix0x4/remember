import Foundation

enum ShareError: LocalizedError, Sendable {
    case missingURL
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .missingURL: "No web link was shared."
        case .invalidURL: "Remember can only save web links."
        }
    }
}
