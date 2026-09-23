import Foundation

enum MemoryReflection: String, Codable, CaseIterable, Identifiable, Sendable {
    case stillTrue = "still_true"
    case changedMind = "changed_mind"
    case notSure = "not_sure"
    case noLongerRelevant = "no_longer_relevant"

    var id: Self { self }

    var label: String {
        switch self {
        case .stillTrue: "Still true"
        case .changedMind: "I see it differently"
        case .notSure: "Not sure yet"
        case .noLongerRelevant: "Let it go"
        }
    }

    var systemImage: String {
        switch self {
        case .stillTrue: "checkmark"
        case .changedMind: "arrow.triangle.2.circlepath"
        case .notSure: "ellipsis"
        case .noLongerRelevant: "leaf"
        }
    }

    var insightTitle: String {
        switch self {
        case .stillTrue: "Kept as part of your compass."
        case .changedMind: "Your change of mind is part of the story."
        case .notSure: "Left open without forcing an answer."
        case .noLongerRelevant: "Released from your current guidance."
        }
    }

    var insightBody: String {
        switch self {
        case .stillTrue: "Remember will treat this as something that still feels true now."
        case .changedMind: "Remember will use this as evidence of how your thinking has evolved."
        case .notSure: "Remember will hold this lightly until new context can help."
        case .noLongerRelevant: "Remember will stop bringing this back as something you should follow."
        }
    }
}

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
    var principleID: UUID? = nil
    var principleStatus: String? = nil
    var analysisScope: String? = nil
    var returnCue: ReturnCue? = nil
    var returnAt: Date? = nil
    var noteText: String? = nil

    var isVideoSource: Bool {
        sourceType == .youtube
            || isTikTokSource
            || (sourcePreviewURL != nil && ["x.com", "twitter.com"].contains(normalizedSourceHost))
    }

    var sourceLabel: String {
        if isTikTokSource { return "TikTok" }
        guard ["x.com", "twitter.com"].contains(normalizedSourceHost) else { return sourceType.label }
        return isVideoSource ? "X video" : "X post"
    }

    var analysisScopeLabel: String? {
        guard state == .ready else { return nil }
        return switch analysisScope {
        case "transcript": "Transcript analyzed"
        case "caption": "Caption analyzed"
        case "post": "Post text analyzed"
        case "article": "Article analyzed"
        case "thought": "Your thought reflected"
        default: nil
        }
    }

    private var isTikTokSource: Bool {
        normalizedSourceHost == "tiktok.com" || normalizedSourceHost.hasSuffix(".tiktok.com")
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
