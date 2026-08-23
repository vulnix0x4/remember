import Foundation
@testable import Remember

final class URLProtocolResponseStore: @unchecked Sendable {
    private let lock = NSLock()
    private var data = Data()
    private var statusCode = 200
    private var request: URLRequest?
    private var body: Data?

    func configure(data: Data, statusCode: Int = 200) {
        lock.withLock {
            self.data = data
            self.statusCode = statusCode
            request = nil
            body = nil
        }
    }

    func response(for request: URLRequest) throws -> (HTTPURLResponse, Data) {
        try lock.withLock {
            self.request = request
            body = request.httpBody ?? Self.read(stream: request.httpBodyStream)
            guard let url = request.url,
                  let response = HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: ["Content-Type": "application/json"]) else {
                throw APIError.invalidResponse
            }
            return (response, data)
        }
    }

    func lastRequest() -> URLRequest? { lock.withLock { request } }
    func lastBody() -> Data? { lock.withLock { body } }

    private static func read(stream: InputStream?) -> Data? {
        guard let stream else { return nil }
        stream.open()
        defer { stream.close() }
        var result = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while true {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            result.append(contentsOf: buffer.prefix(count))
        }
        return result
    }
}
