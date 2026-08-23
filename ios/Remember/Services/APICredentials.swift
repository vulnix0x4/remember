import Foundation

struct APICredentials: Sendable {
    static let localDevelopmentUserID = "00000000-0000-4000-8000-000000000001"
    let bearerToken: String?

    func headers(for baseURL: URL) -> [String: String] {
        switch baseURL.host()?.lowercased() {
        case "localhost", "127.0.0.1", "::1":
            ["x-dev-user-id": Self.localDevelopmentUserID]
        default:
            if let bearerToken, !bearerToken.isEmpty { ["authorization": "Bearer \(bearerToken)"] } else { [:] }
        }
    }
}
