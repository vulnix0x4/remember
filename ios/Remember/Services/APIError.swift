import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The server returned an unreadable response."
        case .server(let code): "The server returned status \(code)."
        }
    }
}
