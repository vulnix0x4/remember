import Foundation

enum LibraryExporter {
    static func data(for imprints: [Imprint], format: ExportFormat) throws -> Data {
        switch format {
        case .json:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            return try encoder.encode(imprints)
        case .markdown:
            let text = imprints.map { imprint in
                let ideas = bullets(imprint.keyIdeas)
                let moments = imprint.moments.map { moment in
                    "- [\(moment.timestamp)](\(timestampURL(for: imprint.url, seconds: moment.seconds).absoluteString)): **\(moment.title)**: \(moment.detail)"
                }.joined(separator: "\n")
                let connections = imprint.connections.map { connection in
                    "- `\(connection.type.rawValue)` → \(connection.title) (`\(connection.itemID.uuidString)`): \(connection.explanation)"
                }.joined(separator: "\n")
                return """
                # \(imprint.title)

                - ID: `\(imprint.id.uuidString)`
                - Source: \(imprint.url.absoluteString)
                - Source type: `\(imprint.sourceType.rawValue)`
                - Creator: \(imprint.creator)
                - Saved: \(imprint.savedAt.formatted(.iso8601))
                - Life period: \(imprint.lifePeriod)
                - Processing state: `\(imprint.state.rawValue)`
                - Personal reaction: \(imprint.reaction ?? "None recorded")

                ## Essence
                \(imprint.essence)

                ## Summary
                \(imprint.summary)

                ## Important ideas
                \(ideas)

                ## Key moments
                \(moments)

                ## Themes
                \(bullets(imprint.themes))

                ## Claims
                \(bullets(imprint.claims))

                ## Candidate principles
                \(bullets(imprint.candidatePrinciples))

                ## Actionable experiments
                \(bullets(imprint.experiments))

                ## Possible personal relevance
                These are possibilities, not facts about the user.
                \(bullets(imprint.personalHypotheses))

                ## Uncertainties
                \(bullets(imprint.uncertainties))

                ## Typed connections
                \(connections)
                """
            }.joined(separator: "\n\n---\n\n")
            return Data(text.utf8)
        }
    }

    private static func bullets(_ values: [String]) -> String {
        values.isEmpty ? "- None" : values.map { "- \($0)" }.joined(separator: "\n")
    }

    private static func timestampURL(for url: URL, seconds: Int) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        var query = components.queryItems ?? []
        query.removeAll { $0.name == "t" }
        query.append(URLQueryItem(name: "t", value: "\(seconds)s"))
        components.queryItems = query
        return components.url ?? url
    }
}
