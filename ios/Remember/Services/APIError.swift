import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case server(Int)
    case response(status: Int, code: String?, message: String?, requestID: String?)

    var statusCode: Int? {
        switch self {
        case .invalidResponse: nil
        case .server(let status): status
        case .response(let status, _, _, _): status
        }
    }

    var code: String? {
        guard case .response(_, let code, _, _) = self else { return nil }
        return code
    }

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The server returned an unreadable response."
        case .server(let code): "The server returned status \(code)."
        case .response(let status, _, let message, _): message ?? "The server returned status \(status)."
        }
    }
}
