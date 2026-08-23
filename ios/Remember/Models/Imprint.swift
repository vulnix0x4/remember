import Foundation

struct Imprint: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let url: URL
    let thumbnailURL: URL?
    let sourceType: SourceType
    let title: String
    let creator: String
    let savedAt: Date
    let lifePeriod: String
    let essence: String
    let summary: String
    let keyIdeas: [String]
    let moments: [KeyMoment]
    let themes: [String]
    let claims: [String]
    let candidatePrinciples: [String]
    let experiments: [String]
    let personalHypotheses: [String]
    let uncertainties: [String]
    let connections: [Connection]
    let state: ProcessingState
    let reaction: String?

    var isVideoSource: Bool {
        sourceType == .youtube || (sourcePreviewURL != nil && ["x.com", "twitter.com"].contains(normalizedSourceHost))
    }

    var sourceLabel: String {
        guard ["x.com", "twitter.com"].contains(normalizedSourceHost) else { return sourceType.label }
        return isVideoSource ? "X video" : "X post"
    }

    private var normalizedSourceHost: String {
        url.host()?.lowercased().replacingOccurrences(of: "www.", with: "") ?? ""
    }

    var sourcePreviewURL: URL? {
        if let thumbnailURL { return thumbnailURL }
        guard sourceType == .youtube, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        let host = components.host?.lowercased() ?? ""
        let videoID: String?
        if host == "youtu.be" {
            videoID = components.path.split(separator: "/").first.map(String.init)
        } else if host == "youtube.com" || host.hasSuffix(".youtube.com") {
            videoID = components.queryItems?.first(where: { $0.name == "v" })?.value
        } else {
            videoID = nil
        }
        guard let videoID, videoID.count == 11,
              videoID.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else { return nil }
        return URL(string: "https://i.ytimg.com/vi/\(videoID)/hqdefault.jpg")
    }
}
