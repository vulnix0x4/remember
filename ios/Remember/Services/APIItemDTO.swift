import Foundation

struct APIItemDTO: Decodable, Sendable {
    struct Analysis: Decodable, Sendable {
        let essence: String
        let summary: String
        let keyIdeas: [KeyIdea]
        let keyMoments: [Moment]
        let themes: [String]
        let claims: [Claim]
        let candidatePrinciples: [Principle]
        let actionableExperiments: [Experiment]
        let personalRelevanceHypotheses: [Hypothesis]
        let uncertainties: [Uncertainty]
    }

    struct KeyIdea: Decodable, Sendable { let text: String; let explanation: String? }
    struct Moment: Decodable, Sendable { let seconds: Int; let label: String; let context: String?; let sourceVerified: Bool? }
    struct Claim: Decodable, Sendable { let text: String; let confidence: Double? }
    struct Principle: Decodable, Sendable { let text: String; let rationale: String? }
    struct Experiment: Decodable, Sendable { let text: String; let duration: String? }
    struct Hypothesis: Decodable, Sendable { let text: String; let evidence: [String]?; let confidence: Double?; let label: String? }
    struct Uncertainty: Decodable, Sendable { let text: String; let field: String? }

    let id: String
    let sourceType: String
    let originalUrl: String
    let canonicalUrl: String
    let title: String?
    let author: String?
    let thumbnailUrl: String?
    let status: String
    let savedAt: String
    let personalReaction: String?
    let processingError: String?
    let analysis: Analysis?
}
