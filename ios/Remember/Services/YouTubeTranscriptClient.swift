import Foundation

struct YouTubeTranscriptClient: Sendable {
    private let session: URLSession
    private let retryDelays: [Duration]

    init(session: URLSession = .shared, retryDelays: [Duration] = []) {
        self.session = session
        self.retryDelays = retryDelays
    }

    func transcript(for sourceURL: URL) async -> String? {
        guard let videoID = Self.videoID(from: sourceURL),
              let endpoint = URL(string: "https://youtube-transcript.ai/transcript/\(videoID).txt") else { return nil }

        for attempt in 0...retryDelays.count {
            if attempt > 0 {
                do {
                    try await Task.sleep(for: retryDelays[attempt - 1])
                } catch {
                    return nil
                }
            }

            var request = URLRequest(url: endpoint)
            request.timeoutInterval = 8
            request.setValue("text/markdown", forHTTPHeaderField: "Accept")

            do {
                let (data, response) = try await session.data(for: request)
                guard let response = response as? HTTPURLResponse,
                      (200..<300).contains(response.statusCode),
                      data.count <= 512 * 1_024,
                      let document = String(data: data, encoding: .utf8) else { continue }
                if let transcript = Self.transcriptSection(in: document) { return transcript }
            } catch {
                if Task.isCancelled { return nil }
            }
        }
        return nil
    }

    static func videoID(from url: URL) -> String? {
        let host = url.host()?.lowercased().replacing(/^www\./, with: "")
        let candidate: String?
        if host == "youtu.be" {
            candidate = url.pathComponents.dropFirst().first
        } else if host == "youtube.com" || host == "m.youtube.com" {
            candidate = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "v" })?.value
                ?? videoIDFromPath(url.pathComponents)
        } else {
            candidate = nil
        }
        guard let candidate, candidate.wholeMatch(of: /[A-Za-z0-9_-]{11}/) != nil else { return nil }
        return candidate
    }

    static func transcriptSection(in document: String) -> String? {
        guard let marker = document.range(of: "## Transcript") else { return nil }
        let tail = document[marker.upperBound...]
        let end = tail.range(of: "\n---")?.lowerBound ?? tail.endIndex
        let section = tail[..<end].trimmingCharacters(in: .whitespacesAndNewlines)
        guard section.count <= 160_000,
              section.split(whereSeparator: \.isNewline).contains(where: {
                  $0.firstMatch(of: /^\[\d{1,2}:\d{2}(?::\d{2})?\]/) != nil
              }) else { return nil }
        return section
    }

    private static func videoIDFromPath(_ components: [String]) -> String? {
        guard let kindIndex = components.firstIndex(where: { ["shorts", "live", "embed"].contains($0.lowercased()) }),
              components.indices.contains(kindIndex + 1) else { return nil }
        return components[kindIndex + 1]
    }
}
