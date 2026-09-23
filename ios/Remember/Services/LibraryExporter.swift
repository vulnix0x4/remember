import Foundation

enum LibraryExporter {
    private struct PortableExport: Codable {
        let schemaVersion: Int
        let exportedAt: Date
        let imprints: [Imprint]
        let life: LifeSnapshot
    }

    static func data(for imprints: [Imprint], life: LifeSnapshot = .empty, format: ExportFormat) throws -> Data {
        switch format {
        case .json:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            return try encoder.encode(PortableExport(schemaVersion: 2, exportedAt: .now, imprints: imprints, life: life))
        case .markdown:
            let memories = imprints.map { imprint in
                let ideas = bullets(imprint.keyIdeas)
                let sourceLine = imprint.sourceType == .note
                    ? "- Kind: Personal thought"
                    : "- Source: \(imprint.url.absoluteString)\n- Source type: `\(imprint.sourceType.rawValue)`"
                let originalWords = imprint.noteText.map { "## Your words\n\($0)\n" } ?? ""
                let moments = imprint.moments.map { moment in
                    "- [\(moment.timestamp)](\(timestampURL(for: imprint.url, seconds: moment.seconds).absoluteString)): **\(moment.title)**: \(moment.detail)"
                }.joined(separator: "\n")
                let connections = imprint.connections.map { connection in
                    "- `\(connection.type.rawValue)` → \(connection.title) (`\(connection.itemID.uuidString)`): \(connection.explanation)"
                }.joined(separator: "\n")
                return """
                # \(imprint.title)

                - ID: `\(imprint.id.uuidString)`
                \(sourceLine)
                - Creator: \(imprint.creator)
                - Saved: \(imprint.savedAt.formatted(.iso8601))
                - Life period: \(imprint.lifePeriod)
                - Processing state: `\(imprint.state.rawValue)`
                - Personal reaction: \(imprint.reaction ?? "None recorded")

                \(originalWords)

                ## Key takeaway
                \(imprint.essence)

                ## Summary
                \(imprint.summary)

                ## Important ideas
                \(ideas)

                ## Key moments
                \(moments)

                ## Topics
                \(bullets(imprint.themes))

                ## Claims
                \(bullets(imprint.claims))

                ## Takeaways
                \(bullets(imprint.candidatePrinciples))

                ## Things to try
                \(bullets(imprint.experiments))

                ## Possible personal relevance
                These are possibilities, not facts about the user.
                \(bullets(imprint.personalHypotheses))

                ## Uncertainties
                \(bullets(imprint.uncertainties))

                ## Related saves
                \(connections)
                """
            }.joined(separator: "\n\n---\n\n")
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let lifeJSON = String(decoding: try encoder.encode(life), as: UTF8.self)
            let text = """
            \(memories)

            ---

            # Remember data

            Attached file contents are downloaded separately; their metadata is included below.

            ```json
            \(lifeJSON)
            ```
            """
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
