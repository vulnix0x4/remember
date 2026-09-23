import Foundation
@testable import Remember

final class URLProtocolResponseStore: @unchecked Sendable {
    struct StubResponse: Sendable {
        let data: Data
        let statusCode: Int
    }

    private let lock = NSLock()
    private var responses = [StubResponse(data: Data(), statusCode: 200)]
    private var request: URLRequest?
    private var body: Data?
    private var recordedRequests: [URLRequest] = []
    private var recordedBodies: [Data?] = []

    func configure(data: Data, statusCode: Int = 200) {
        configure(responses: [StubResponse(data: data, statusCode: statusCode)])
    }

    func configure(responses: [StubResponse]) {
        lock.withLock {
            self.responses = responses.isEmpty ? [StubResponse(data: Data(), statusCode: 200)] : responses
            request = nil
            body = nil
            recordedRequests = []
            recordedBodies = []
        }
    }

    func response(for request: URLRequest) throws -> (HTTPURLResponse, Data) {
        try lock.withLock {
            self.request = request
            body = request.httpBody ?? Self.read(stream: request.httpBodyStream)
            recordedRequests.append(request)
            recordedBodies.append(body)
            let stub = responses.count > 1 ? responses.removeFirst() : responses[0]
            guard let url = request.url,
                  let response = HTTPURLResponse(url: url, statusCode: stub.statusCode, httpVersion: nil, headerFields: ["Content-Type": "application/json"]) else {
                throw APIError.invalidResponse
            }
            return (response, stub.data)
        }
    }

    func lastRequest() -> URLRequest? { lock.withLock { request } }
    func lastBody() -> Data? { lock.withLock { body } }
    func allRequests() -> [URLRequest] { lock.withLock { recordedRequests } }
    func allBodies() -> [Data?] { lock.withLock { recordedBodies } }

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
