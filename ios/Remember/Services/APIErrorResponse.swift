import Foundation

struct APIErrorResponse: Decodable, Sendable {
    struct ErrorDetail: Decodable, Sendable {
        let code: String?
        let message: String?
    }

    let error: ErrorDetail
    let requestId: String?
}
