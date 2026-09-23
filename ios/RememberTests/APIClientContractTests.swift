import Foundation
import Testing
@testable import Remember

struct APIClientContractTests {
    @Test func everydayDecisionUsesServerProviderWithoutSendingAProviderKey() async throws {
        let json = """
        {"provider":"openrouter","model":"typesafe/jev-1.13","evaluatedAt":"2026-09-19T16:00:00.000Z","expiresAt":"2026-09-19T16:05:00.000Z","confidence":0.92,"disposition":"decided","availableMinutes":15,"focusStarted":true,"selected":{"id":"81000000-0000-4000-8000-000000000002","kind":"task","title":"Write outline","firstStep":"Open notes","durationMinutes":15,"facts":["Your priority: high."]},"alternatives":[]}
        """
        URLProtocolStub.store.configure(data: Data(json.utf8))
        let client = try makeClient(baseURL: "http://127.0.0.1:8787")
        let result = try await client.decideNextMove(EverydayDecisionRequest(
            availableMinutes: 15, energy: "low", timeZone: "America/Denver", excludedIds: [], startFocus: true
        ))
        #expect(result.focusStarted)
        #expect(result.selected.title == "Write outline")
        #expect(result.confidence == 0.92)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life/autopilot")
        #expect(request.httpMethod == "POST")
        let body = try #require(URLProtocolStub.store.lastBody())
        let payload = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(payload["startFocus"] as? Bool == true)
        #expect(payload["timeZone"] as? String == "America/Denver")
        #expect(payload["apiKey"] == nil)
    }
    @Test func automaticBrainSyncAndPreferencesUseTheServerContract() async throws {
        let json = """
        {"brain":{"settings":{"enabled":true,"timeZone":"America/Denver","startHour":8,"endHour":21,"preferences":"Chores after work"},"status":"ready","message":"Your next steps are in place.","model":"typesafe/jev-1.13","evaluatedAt":"2026-09-19T16:00:00.000Z","nextCheckAt":null,"plan":[{"taskId":"81000000-0000-4000-8000-000000000002","title":"Laundry","firstStep":"Collect clothes","startAt":"2026-09-19T23:00:00.000Z","endAt":"2026-09-19T23:30:00.000Z","confidence":0.95,"reason":"An open slot"}],"contextUsed":["Your preferences"],"unscheduledCount":0}}
        """
        URLProtocolStub.store.configure(data: Data(json.utf8))
        let client = try makeClient(baseURL: "http://127.0.0.1:8787")
        let result = try await client.syncBrain()
        #expect(result?.plan.first?.title == "Laundry")
        #expect(URLProtocolStub.store.lastRequest()?.url?.path == "/api/life/brain/sync")
        var settings = try #require(result?.settings)
        settings.enabled = false
        _ = try await client.syncBrain(settings: settings)
        #expect(URLProtocolStub.store.lastRequest()?.httpMethod == "PATCH")
        #expect(URLProtocolStub.store.lastRequest()?.url?.path == "/api/life/brain")
        let body = try #require(URLProtocolStub.store.lastBody())
        let payload = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(payload["enabled"] as? Bool == false)
        #expect(payload["preferences"] as? String == "Chores after work")
        #expect(payload["apiKey"] == nil)
    }
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
        let item = try await client.capture(
            url: sourceURL,
            personalReaction: "This helps me protect my attention.",
            returnCue: .focus,
            returnAt: nil
        )
        #expect(item.state == .processing)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "x-dev-user-id") == nil)
        #expect(request.value(forHTTPHeaderField: "idempotency-key")?.isEmpty == false)
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["url"] == sourceURL.absoluteString)
        #expect(json["sourceText"] == transcript)
        #expect(json["personalReaction"] == "This helps me protect my attention.")
        #expect(json["returnCue"] == "focus")
        #expect(json["returnAt"] == nil)
    }

    @Test func thoughtCaptureIsFirstClassAndDoesNotPretendToBeAWebLink() async throws {
        URLProtocolStub.store.configure(data: Data(Self.thoughtCaptureJSON.utf8), statusCode: 202)
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let thought = "The first quiet hour is where I can hear myself think."

        let item = try await client.captureThought(thought, returnCue: .focus, returnAt: nil)

        #expect(item.sourceType == .note)
        #expect(item.noteText == thought)
        #expect(item.sourceLabel == "Thought")
        #expect(item.url.scheme == "remember")
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/items")
        #expect(request.value(forHTTPHeaderField: "idempotency-key")?.isEmpty == false)
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["thought"] as? String == thought)
        #expect(json["returnCue"] as? String == "focus")
        #expect(json["url"] == nil)
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
        #expect(request.timeoutInterval == 50)
    }

    @Test func askClearsAStaleThreadAndRetriesOnce() async throws {
        URLProtocolStub.store.configure(data: Data(Self.askJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        _ = try await client.ask("What keeps returning?")

        let stale = #"{"error":{"code":"thread_not_found","message":"Conversation not found."},"requestId":"request-stale"}"#
        let fresh = Self.askJSON.replacing(
            "20000000-0000-4000-8000-000000000099",
            with: "20000000-0000-4000-8000-000000000100"
        )
        URLProtocolStub.store.configure(responses: [
            .init(data: Data(stale.utf8), statusCode: 404),
            .init(data: Data(fresh.utf8), statusCode: 200),
        ])

        let answer = try await client.ask("What changed?")

        #expect(answer.text == "Attention keeps returning.")
        let bodies = URLProtocolStub.store.allBodies().compactMap { $0 }
        #expect(bodies.count == 2)
        let staleBody = try #require(JSONSerialization.jsonObject(with: bodies[0]) as? [String: Any])
        let freshBody = try #require(JSONSerialization.jsonObject(with: bodies[1]) as? [String: Any])
        #expect(staleBody["threadId"] as? String == "20000000-0000-4000-8000-000000000099")
        #expect(freshBody["threadId"] == nil)
    }

    @Test func askPreservesStructuredServerErrorsForHelpfulRecovery() async throws {
        let failure = #"{"error":{"code":"rate_limited","message":"Please wait before asking again."},"requestId":"request-rate"}"#
        URLProtocolStub.store.configure(data: Data(failure.utf8), statusCode: 429)
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        do {
            _ = try await client.ask("What keeps returning?")
            Issue.record("A rate-limited Ask unexpectedly succeeded")
        } catch let error as APIError {
            #expect(error.statusCode == 429)
            #expect(error.code == "rate_limited")
            #expect(error.errorDescription == "Please wait before asking again.")
        }
    }

    @Test func evolutionMapsOnlyServerSupportedFacts() async throws {
        URLProtocolStub.store.configure(data: Data(Self.evolutionJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        let overview = try await client.fetchEvolution()

        #expect(overview.themes == [EvolutionTheme(name: "Discipline", count: 2, lastSeenAt: "2026-08-22T12:00:00Z")])
        #expect(overview.principles.first?.itemId == "20000000-0000-4000-8000-000000000001")
        #expect(overview.tensions.isEmpty)
        #expect(overview.timeline.first?.count == 2)
        #expect(overview.reflections.first?.response == "changed_mind")
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

    @Test func memoryCheckInRecordsTheUsersCurrentJudgment() async throws {
        URLProtocolStub.store.configure(data: Data(#"{"recorded":true}"#.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let itemID = try #require(UUID(uuidString: "20000000-0000-4000-8000-000000000002"))

        try await client.reflectOnMemory(itemID: itemID, response: .changedMind)

        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/items/20000000-0000-4000-8000-000000000002/reflect")
        #expect(request.httpMethod == "POST")
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["response"] == "changed_mind")
    }

    @Test func contextualReturnFeedbackRemembersWhatBelongsToday() async throws {
        URLProtocolStub.store.configure(data: Data(#"{"recorded":true}"#.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let itemID = try #require(UUID(uuidString: "20000000-0000-4000-8000-000000000002"))

        try await client.rateContextualReturn(itemID: itemID, response: .notToday)

        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/items/20000000-0000-4000-8000-000000000002/contextual-return-feedback")
        #expect(request.httpMethod == "POST")
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json["response"] == "not_today")
    }

    @Test func lifeSnapshotDecodesTheUnifiedPrivateDashboard() async throws {
        URLProtocolStub.store.configure(data: Data(Self.lifeJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        let snapshot = try await client.fetchLifeSnapshot()

        #expect(snapshot.activeTask?.title == "Open the project")
        #expect(snapshot.goals.first?.area == .direction)
        #expect(snapshot.floor.first?.completionDates.count == 1)
        #expect(snapshot.events.first?.title == "Flight")
        #expect(snapshot.health.first?.type == "steps")
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
    }

    @Test func practiceResultUsesTheExperimentCompletionContract() async throws {
        URLProtocolStub.store.configure(data: Data(Self.completedPracticeJSON.utf8))
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let taskID = try #require(UUID(uuidString: "10000000-0000-4000-8000-000000000007"))

        try await client.completeLifeTask(
            id: taskID,
            minutesSpent: 15,
            result: PracticeResult(outcome: .helped, reflection: "Starting first changed the whole session.")
        )

        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life/tasks/10000000-0000-4000-8000-000000000007/complete")
        let body = try #require(URLProtocolStub.store.lastBody())
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["minutesSpent"] as? Int == 15)
        let result = try #require(json["result"] as? [String: String])
        #expect(result["outcome"] == "helped")
        #expect(result["reflection"] == "Starting first changed the whole session.")
    }

    @Test func vaultUploadUsesAuthenticatedMultipartData() async throws {
        URLProtocolStub.store.configure(data: Data(Self.fileJSON.utf8), statusCode: 201)
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")

        let file = try await client.uploadVaultFile(data: Data("private plan".utf8), name: "plan.txt", mimeType: "text/plain")

        #expect(file.name == "plan.txt")
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life/files")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "content-type")?.hasPrefix("multipart/form-data; boundary=") == true)
        let bodyData = try #require(URLProtocolStub.store.lastBody())
        let body = try #require(String(data: bodyData, encoding: .utf8))
        #expect(body.contains("filename=\"plan.txt\""))
        #expect(body.contains("private plan"))
    }

    @Test func vaultDownloadUsesAuthenticatedGETAndReturnsBytesWithoutDecoding() async throws {
        let expected = Data([0x00, 0x7F, 0xFF, 0x42])
        URLProtocolStub.store.configure(data: expected)
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let fileID = try #require(UUID(uuidString: "ABCDEF00-0000-4000-8000-000000000001"))

        let downloaded = try await client.downloadVaultFile(id: fileID)

        #expect(downloaded == expected)
        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life/files/abcdef00-0000-4000-8000-000000000001/download")
        #expect(request.httpMethod == "GET")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "x-dev-user-id") == nil)
        #expect(request.httpBody == nil)
        #expect(URLProtocolStub.store.lastBody() == nil)
        #expect(request.timeoutInterval == 60)
    }

    @Test func vaultDeleteUsesAuthenticatedDELETEAndAcceptsAnEmptyResponse() async throws {
        URLProtocolStub.store.configure(data: Data(), statusCode: 204)
        let client = try makeClient(baseURL: "https://preview.remember.test", bearerToken: "test-token")
        let fileID = try #require(UUID(uuidString: "ABCDEF00-0000-4000-8000-000000000002"))

        try await client.deleteVaultFile(id: fileID)

        let request = try #require(URLProtocolStub.store.lastRequest())
        #expect(request.url?.path == "/api/life/files/abcdef00-0000-4000-8000-000000000002")
        #expect(request.httpMethod == "DELETE")
        #expect(request.value(forHTTPHeaderField: "authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "x-dev-user-id") == nil)
        #expect(request.httpBody == nil)
        #expect(URLProtocolStub.store.lastBody() == nil)
        #expect(request.timeoutInterval == 30)
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

    private static let thoughtCaptureJSON = #"""
    {"item":{"id":"20000000-0000-4000-8000-000000000005","sourceType":"note","originalUrl":"remember://thought/20000000-0000-4000-8000-000000000005","canonicalUrl":"remember://thought/20000000-0000-4000-8000-000000000005","title":"The first quiet hour is where I can hear myself think.","author":"You","noteText":"The first quiet hour is where I can hear myself think.","status":"pending","savedAt":"2026-09-01T12:00:00Z","personalReaction":null,"returnCue":"focus","returnAt":null,"processingError":null,"analysisScope":null,"analysis":null},"deduplicated":false,"duplicate":false}
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
    {"themes":[{"name":"Discipline","count":2,"lastSeenAt":"2026-08-22T12:00:00Z"}],"principles":[{"id":"principle-1","itemId":"20000000-0000-4000-8000-000000000001","text":"Use what you already have.","rationale":"Supported by the source.","status":"candidate","createdAt":"2026-08-22T12:00:00Z"}],"tensions":[],"timeline":[{"month":"2026-08","theme":"Discipline","count":2}],"reflections":[{"id":"reflection-1","itemId":"20000000-0000-4000-8000-000000000001","response":"changed_mind","occurredAt":"2026-08-30T12:00:00Z"}]}
    """#

    private static let lifeJSON = #"""
    {"goals":[{"id":"10000000-0000-4000-8000-000000000001","title":"Ship Remember","area":"direction","vision":"","why":"Make life coherent","status":"active","progress":25,"targetDate":null,"createdAt":"2026-08-31T12:00:00.123Z","updatedAt":"2026-08-31T12:00:00.123Z"}],"tasks":[{"id":"10000000-0000-4000-8000-000000000002","goalId":"10000000-0000-4000-8000-000000000001","title":"Open the project","firstStep":"Open Xcode","notes":"","area":"work","status":"active","priority":"high","energy":"any","durationMinutes":15,"dueAt":null,"scheduledStart":null,"scheduledEnd":null,"source":"goal","completedAt":null,"createdAt":"2026-08-31T12:00:00.123Z","updatedAt":"2026-08-31T12:00:00.123Z"}],"blockers":[],"floor":[{"id":"10000000-0000-4000-8000-000000000003","title":"Take medication","area":"health","target":1,"unit":"time","completionDates":["2026-08-31T12:00:00.123Z"],"createdAt":"2026-08-31T12:00:00.123Z","updatedAt":"2026-08-31T12:00:00.123Z"}],"events":[{"id":"10000000-0000-4000-8000-000000000004","externalId":"flight-1","source":"apple","calendarName":"Personal","title":"Flight","notes":"","location":"LAS","url":null,"startAt":"2026-08-31T15:00:00.123Z","endAt":"2026-08-31T17:00:00.123Z","allDay":false,"status":"confirmed","createdAt":"2026-08-31T12:00:00.123Z","updatedAt":"2026-08-31T12:00:00.123Z"}],"health":[{"id":"10000000-0000-4000-8000-000000000005","externalId":"steps-1","type":"steps","value":7500,"unit":"count","startAt":"2026-08-31T00:00:00.123Z","endAt":"2026-08-31T12:00:00.123Z","source":"Apple Watch","metadata":{"bundleIdentifier":"com.apple.health"},"createdAt":"2026-08-31T12:00:00.123Z"}],"accounts":[],"transactions":[],"files":[]}
    """#

    private static let completedPracticeJSON = #"""
    {"task":{"id":"10000000-0000-4000-8000-000000000007","goalId":null,"title":"Make before consuming","firstStep":"Create for fifteen minutes","notes":"","area":"work","status":"done","priority":"normal","energy":"any","durationMinutes":15,"dueAt":null,"scheduledStart":null,"scheduledEnd":null,"source":"practice","sourceItemId":null,"practiceOutcome":"helped","practiceReflection":"Starting first changed the whole session.","reflectedAt":"2026-09-01T12:00:00Z","completedAt":"2026-09-01T12:00:00Z","createdAt":"2026-08-31T12:00:00Z","updatedAt":"2026-09-01T12:00:00Z"},"next":null}
    """#

    private static let fileJSON = #"""
    {"file":{"id":"10000000-0000-4000-8000-000000000006","name":"plan.txt","mimeType":"text/plain","sizeBytes":12,"folder":"","tags":[],"summary":"","createdAt":"2026-08-31T12:00:00Z","updatedAt":"2026-08-31T12:00:00Z"}}
    """#
}
