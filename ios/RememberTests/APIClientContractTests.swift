import Foundation
import Testing
@testable import Remember

struct APIClientContractTests {
    @Test func passwordLoginUsesTheProductionSessionContract() async throws {
        URLProtocolStub.store.configure(data: Data(Self.sessionJSON.utf8))
        let client = try makeClient(baseURL: "https://remember.example.test")

        try await client.login(email: "owner@example.com", password: "private-password")

        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/auth/login")
        #expect(request.httpMethod == "POST")
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["email"] == "owner@example.com")
        #expect(json["password"] == "private-password")
    }

    @Test func listEnvelopeMapsBackendDTOAndUsesLocalAuth() async throws {
        URLProtocolStub.store.configure(data: Data(Self.listJSON.utf8))
        let client = try makeClient(baseURL: "http://127.0.0.1:8787")
        let items = try await client.fetchImprints()
        let item = try #require(items.first)
        #expect(item.title == "A mapped source")
        #expect(item.state == .ready)
        #expect(item.keyIdeas == ["Keep the useful part"])
        #expect(item.moments.first?.seconds == 75)
        #expect(item.claims == ["Attention compounds"])
        #expect(item.personalHypotheses.first?.contains("may") == true)
        #expect(item.sourcePreviewURL?.absoluteString == "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.value(forHTTPHeaderField: "x-dev-user-id") == APICredentials.localDevelopmentUserID)
        #expect(request.value(forHTTPHeaderField: "authorization") == nil)
    }

    @Test func captureEnvelopeMapsAndUsesRemoteBearerAuth() async throws {
        URLProtocolStub.store.configure(data: Data(Self.captureJSON.utf8), statusCode: 202)
        let transcript = "[0:01] A grounded opening."
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token", youtubeTranscript: transcript)
        let sourceURL = try #require(URL(string: "https://youtube.com/watch?v=abc"))
        let item = try await client.capture(url: sourceURL)
        #expect(item.state == .processing)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "x-dev-user-id") == nil)
        #expect(request.value(forHTTPHeaderField: "idempotency-key")?.isEmpty == false)
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["url"] == sourceURL.absoluteString)
        #expect(json["sourceText"] == transcript)
    }

    @Test func tikTokItemIsPresentedAsAPlayableTikTokSource() async throws {
        URLProtocolStub.store.configure(data: Data(Self.tikTokListJSON.utf8))
        let client = try makeClient(baseURL: "https://remember.example.test")

        let item = try #require(try await client.fetchImprints().first)

        #expect(item.sourceLabel == "TikTok")
        #expect(item.isVideoSource)
        #expect(item.creator == "Scout, Suki & Stella")
        #expect(item.sourcePreviewURL?.host() == "p19-common-sign.tiktokcdn-us.com")
    }

    @Test func retryUsesTheItemRecoveryEndpoint() async throws {
        URLProtocolStub.store.configure(data: Data(Self.retryJSON.utf8), statusCode: 202)
        let transcript = "[0:02] The retry is source grounded."
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token", youtubeTranscript: transcript)
        let itemID = try #require(UUID(uuidString: "20000000-0000-4000-8000-000000000002"))

        let sourceURL = try #require(URL(string: "https://youtu.be/abcdefghijk"))
        let item = try await client.retry(itemID: itemID, sourceURL: sourceURL)

        #expect(item.state == .processing)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/items/20000000-0000-4000-8000-000000000002/retry")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["sourceText"] == transcript)
    }

    @Test func failedTimeoutIsMappedToOneHelpfulRecoveryMessage() async throws {
        URLProtocolStub.store.configure(data: Data(Self.failedListJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        let item = try #require(try await client.fetchImprints().first)

        #expect(item.summary.isEmpty)
        #expect(item.uncertainties == ["Analysis took longer than expected. Your source is saved safely. Try again."])
    }

    @Test func malformedEnvelopeThrowsWithoutRepositoryFallback() async throws {
        URLProtocolStub.store.configure(data: Data(#"{"items":[{"id":"not-a-uuid"}]}"#.utf8))
        let client = try makeClient(baseURL: "http://127.0.0.1:8787")
        do {
            _ = try await client.fetchImprints()
            Issue.record("Malformed DTO unexpectedly decoded")
        } catch {
            #expect(error is DecodingError)
        }
    }

    @Test func askMapsGroundedCitations() async throws {
        URLProtocolStub.store.configure(data: Data(Self.askJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let answer = try await client.ask("What keeps returning?")
        #expect(answer.grounded)
        #expect(answer.citations.first?.seconds == 75)
        #expect(answer.citations.first?.excerpt == "Source context")
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/ask")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.timeoutInterval == 45)
    }

    @Test func evolutionMapsOnlyServerSupportedFacts() async throws {
        URLProtocolStub.store.configure(data: Data(Self.evolutionJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        let overview = try await client.fetchEvolution()

        #expect(overview.themes == [EvolutionTheme(name: "Discipline", count: 2, lastSeenAt: "2026-08-22T12:00:00Z")])
        #expect(overview.principles.first?.itemId == "20000000-0000-4000-8000-000000000001")
        #expect(overview.tensions.isEmpty)
        #expect(overview.timeline.first?.count == 2)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/evolution")
    }

    @Test func noResurfacingReturnsNilInsteadOfChoosingARecentItem() async throws {
        URLProtocolStub.store.configure(data: Data(#"{"memory":null}"#.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        #expect(try await client.fetchResurfacedItemID() == nil)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/resurfacing/today")
    }

    private func makeClient(baseURL: String, bearerToken: String? = nil, youtubeTranscript: String? = nil) throws -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let url = try #require(URL(string: baseURL))
        return APIClient(
            baseURL: url,
            session: URLSession(configuration: configuration),
            credentials: APICredentials(bearerToken: bearerToken),
            youtubeTranscript: { _ in youtubeTranscript }
        )
    }

    private static let listJSON = #"""
    {"items":[{"id":"20000000-0000-4000-8000-000000000001","sourceType":"youtube","originalUrl":"https://youtube.com/watch?v=abc","canonicalUrl":"https://youtube.com/watch?v=abc","title":"A mapped source","author":"Creator","thumbnailUrl":"https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg","status":"ready","savedAt":"2026-08-21T12:00:00Z","personalReaction":null,"processingError":null,"analysis":{"essence":"A durable idea","summary":"A grounded summary.","keyIdeas":[{"text":"Keep the useful part","explanation":""}],"keyMoments":[{"seconds":75,"label":"The key distinction","context":"Source context","sourceVerified":true}],"themes":["Attention"],"claims":[{"text":"Attention compounds","confidence":0.9}],"candidatePrinciples":[{"text":"Choose deliberately","rationale":""}],"actionableExperiments":[{"text":"Remove one input"}],"personalRelevanceHypotheses":[{"text":"This may matter now","evidence":[],"confidence":0.6,"label":"hypothesis"}],"uncertainties":[{"text":"No reaction was recorded"}]}}],"nextCursor":null}
    """#

    private static let captureJSON = #"""
    {"item":{"id":"20000000-0000-4000-8000-000000000002","sourceType":"youtube","originalUrl":"https://youtube.com/watch?v=abc","canonicalUrl":"https://youtube.com/watch?v=abc","title":null,"author":null,"status":"pending","savedAt":"2026-08-21T12:00:00Z","personalReaction":null,"processingError":null,"analysis":null},"deduplicated":false,"duplicate":false}
    """#

    private static let tikTokListJSON = #"""
    {"items":[{"id":"20000000-0000-4000-8000-000000000004","sourceType":"web","originalUrl":"https://www.tiktok.com/@scout2015/video/6718335390845095173","canonicalUrl":"https://www.tiktok.com/@scout2015/video/6718335390845095173","title":"Scramble up your name","author":"Scout, Suki & Stella","thumbnailUrl":"https://p19-common-sign.tiktokcdn-us.com/example.jpeg","status":"ready","savedAt":"2026-08-23T09:00:00Z","personalReaction":null,"processingError":null,"analysis":null}],"nextCursor":null}
    """#

    private static let retryJSON = #"""
    {"item":{"id":"20000000-0000-4000-8000-000000000002","sourceType":"youtube","originalUrl":"https://youtube.com/watch?v=abc","canonicalUrl":"https://youtube.com/watch?v=abc","title":"Saved video","author":"Creator","status":"pending","savedAt":"2026-08-21T12:00:00Z","personalReaction":null,"processingError":null,"analysis":null}}
    """#

    private static let failedListJSON = #"""
    {"items":[{"id":"20000000-0000-4000-8000-000000000003","sourceType":"youtube","originalUrl":"https://youtube.com/watch?v=abc","canonicalUrl":"https://youtube.com/watch?v=abc","title":"Saved video","author":"Creator","status":"failed","savedAt":"2026-08-21T12:00:00Z","personalReaction":null,"processingError":"The operation was aborted due to timeout","analysis":null}],"nextCursor":null}
    """#

    private static let askJSON = #"""
    {"threadId":"20000000-0000-4000-8000-000000000099","answer":"Attention keeps returning.","citations":[{"itemId":"20000000-0000-4000-8000-000000000001","title":"A mapped source","url":"https://youtube.com/watch?v=abc","timestampSeconds":75,"excerpt":"Source context"}],"grounded":true,"limitations":[]}
    """#

    private static let sessionJSON = #"""
    {"user":{"id":"00000000-0000-4000-8000-000000000001","mode":"password","email":"owner@example.com"}}
    """#

    private static let evolutionJSON = #"""
    {"themes":[{"name":"Discipline","count":2,"lastSeenAt":"2026-08-22T12:00:00Z"}],"principles":[{"id":"principle-1","itemId":"20000000-0000-4000-8000-000000000001","text":"Use what you already have.","rationale":"Supported by the source.","status":"candidate","createdAt":"2026-08-22T12:00:00Z"}],"tensions":[],"timeline":[{"month":"2026-08","theme":"Discipline","count":2}]}
    """#
}
