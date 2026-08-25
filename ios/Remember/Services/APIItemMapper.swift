import Foundation

enum APIItemMapper {
    static func imprint(
        from dto: APIItemDTO,
        connections: [APIItemDetailResponse.ConnectionDTO] = [],
        principle: APIItemDetailResponse.PrincipleDTO? = nil
    ) throws -> Imprint {
        guard let id = UUID(uuidString: dto.id) else { throw APIError.invalidResponse }
        guard let url = URL(string: dto.canonicalUrl.isEmpty ? dto.originalUrl : dto.canonicalUrl),
              URLValidator.validatedWebURL(from: url.absoluteString) != nil else { throw APIError.invalidResponse }
        guard let savedAt = try? Date(dto.savedAt, strategy: .iso8601) else { throw APIError.invalidResponse }
        let analysis = dto.analysis
        let state = state(from: dto.status)
        let fallbackEssence = state == .failed ? "This source could not be analyzed yet." : "Understanding what made this worth keeping."
        let host = url.host()?.replacing(/^www\./, with: "") ?? "Saved source"
        var uncertainties = analysis?.uncertainties.map(\.text) ?? []
        if state == .failed {
            uncertainties.append(failureMessage(for: dto.processingError))
        }

        let currentID = id
        let mappedConnections = try connections.map { connection -> Connection in
            guard let connectionID = UUID(uuidString: connection.id),
                  let fromID = UUID(uuidString: connection.fromItemId),
                  let toID = UUID(uuidString: connection.toItemId),
                  let type = ConnectionType(rawValue: connection.type) else { throw APIError.invalidResponse }
            let relatedID = fromID == currentID ? toID : fromID
            return Connection(
                id: connectionID,
                itemID: relatedID,
                type: type,
                title: connection.relatedTitle ?? "Connected source",
                explanation: connection.explanation
            )
        }

        return Imprint(
            id: id,
            url: url,
            thumbnailURL: dto.thumbnailUrl.flatMap(URL.init(string:)),
            sourceType: dto.sourceType == "youtube" ? .youtube : .web,
            title: dto.title ?? analysis?.essence ?? host,
            creator: dto.author ?? host,
            savedAt: savedAt,
            lifePeriod: "Saved in \(savedAt.formatted(.dateTime.month(.wide).year()))",
            essence: analysis?.essence ?? fallbackEssence,
            summary: analysis?.summary ?? (state == .failed ? "" : "This source is queued for analysis."),
            keyIdeas: analysis?.keyIdeas.map(\.text) ?? [],
            moments: analysis?.keyMoments.map { moment in
                KeyMoment(id: UUID(), seconds: moment.seconds, title: moment.label, detail: moment.context ?? "Open this moment in the source.")
            } ?? [],
            themes: analysis?.themes ?? [],
            claims: analysis?.claims.map(\.text) ?? [],
            candidatePrinciples: analysis?.candidatePrinciples.map(\.text) ?? [],
            experiments: analysis?.actionableExperiments.map(\.text) ?? [],
            personalHypotheses: analysis?.personalRelevanceHypotheses.map(\.text) ?? [],
            uncertainties: uncertainties,
            connections: mappedConnections,
            state: state,
            reaction: dto.personalReaction,
            principleID: principle.flatMap { UUID(uuidString: $0.id) },
            principleStatus: principle?.status,
            analysisScope: dto.analysisScope
        )
    }

    private static func state(from value: String) -> ProcessingState {
        switch value {
        case "ready": .ready
        case "partial": .partial
        case "failed": .failed
        default: .processing
        }
    }

    private static func failureMessage(for processingError: String?) -> String {
        let normalized = processingError?.lowercased() ?? ""
        if normalized.contains("timeout") || normalized.contains("timed out") || normalized.contains("aborted") {
            return "Analysis took longer than expected. Your source is saved safely. Try again."
        }
        if normalized.contains("no readable captions") {
            return "This video has no readable captions, so Remember cannot analyze it faithfully yet."
        }
        if normalized.contains("tiktok") && normalized.contains("caption") {
            return "This TikTok post has no readable public caption, so Remember cannot analyze it faithfully yet."
        }
        if normalized.contains("no readable public text") {
            return "This page has no readable public text, so Remember cannot analyze it faithfully yet."
        }
        return "Remember couldn’t finish analyzing this source. Your link is saved safely. Try again."
    }
}
