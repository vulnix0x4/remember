import Foundation
import Testing
@testable import Remember

struct LibraryExporterTests {
    @Test func JSONExportRoundTrips() throws {
        let data = try LibraryExporter.data(for: FixtureLibrary.imprints, format: .json)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        struct Export: Decodable { let schemaVersion: Int; let imprints: [Imprint]; let life: LifeSnapshot }
        let decoded = try decoder.decode(Export.self, from: data)
        #expect(decoded.schemaVersion == 2)
        #expect(decoded.imprints == FixtureLibrary.imprints)
        #expect(decoded.life.tasks.isEmpty)
    }

    @Test func markdownExportContainsSourceAndEssence() throws {
        let data = try LibraryExporter.data(for: Array(FixtureLibrary.imprints.prefix(2)), format: .markdown)
        let markdown = try #require(String(data: data, encoding: .utf8))
        #expect(markdown.contains("## Essence"))
        #expect(markdown.contains(FixtureLibrary.imprints[0].url.absoluteString))
        #expect(markdown.contains(FixtureLibrary.imprints[0].id.uuidString))
        #expect(markdown.contains("Source type: `youtube`"))
        #expect(markdown.contains("Processing state: `ready`"))
        #expect(markdown.contains("Life period:"))
        #expect(markdown.contains("## Key moments"))
        #expect(markdown.contains("t=132s"))
        #expect(markdown.contains("## Themes"))
        #expect(markdown.contains("## Claims"))
        #expect(markdown.contains("## Candidate principles"))
        #expect(markdown.contains("## Actionable experiments"))
        #expect(markdown.contains("## Possible personal relevance"))
        #expect(markdown.contains("## Uncertainties"))
        #expect(markdown.contains("`supports`"))
        #expect(markdown.contains("I want to remember the difference"))
        #expect(markdown.contains("# Personal Life OS data"))
    }
}
