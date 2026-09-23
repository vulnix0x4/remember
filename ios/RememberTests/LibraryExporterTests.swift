import Foundation
import Testing
@testable import Remember

struct LibraryExporterTests {
    @Test func JSONExportRoundTrips() throws {
        let data = try LibraryExporter.data(for: FixtureLibrary.imprints, format: .json)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        struct Export: Decodable { let schemaVersion: Int; let exportedAt: Date; let imprints: [Imprint]; let life: LifeSnapshot }
        let decoded = try decoder.decode(Export.self, from: data)
        #expect(decoded.schemaVersion == 2)
        #expect(decoded.exportedAt <= .now)
        #expect(decoded.imprints == FixtureLibrary.imprints)
        #expect(decoded.life == .empty)
    }

    @Test func markdownExportUsesPlainLanguageHeadingsAndPreservesEssentialContent() throws {
        let imprints = Array(FixtureLibrary.imprints.prefix(2))
        let data = try LibraryExporter.data(for: imprints, format: .markdown)
        let markdown = try #require(String(data: data, encoding: .utf8))

        #expect(markdown.contains("## Key takeaway"))
        #expect(markdown.contains("## Summary"))
        #expect(markdown.contains("## Important ideas"))
        #expect(markdown.contains("## Key moments"))
        #expect(markdown.contains("## Topics"))
        #expect(markdown.contains("## Claims"))
        #expect(markdown.contains("## Takeaways"))
        #expect(markdown.contains("## Things to try"))
        #expect(markdown.contains("## Possible personal relevance"))
        #expect(markdown.contains("## Uncertainties"))
        #expect(markdown.contains("## Related saves"))
        #expect(markdown.contains("# Remember data"))
        #expect(markdown.contains("Attached file contents are downloaded separately"))
        #expect(!markdown.contains("## Essence"))
        #expect(!markdown.contains("## Candidate principles"))
        #expect(!markdown.contains("## Actionable experiments"))
        #expect(!markdown.contains("# Personal Life OS data"))

        for imprint in imprints {
            #expect(markdown.contains(imprint.url.absoluteString))
            #expect(markdown.contains(imprint.id.uuidString))
            #expect(markdown.contains(imprint.title))
            #expect(markdown.contains(imprint.essence))
            #expect(markdown.contains(imprint.summary))
        }
        #expect(markdown.contains(imprints[0].keyIdeas[0]))
        #expect(markdown.contains(imprints[0].claims[0]))
        #expect(markdown.contains(imprints[0].candidatePrinciples[0]))
        #expect(markdown.contains(imprints[0].experiments[0]))
        #expect(markdown.contains(imprints[0].personalHypotheses[0]))
        #expect(markdown.contains(imprints[0].uncertainties[0]))
        let recordedReaction = try #require(imprints[1].reaction)
        #expect(markdown.contains(recordedReaction))
        #expect(markdown.contains("Source type: `youtube`"))
        #expect(markdown.contains("Processing state: `ready`"))
        #expect(markdown.contains("Life period:"))
        #expect(markdown.contains("t=132s"))
        #expect(markdown.contains("`supports`"))
    }
}
