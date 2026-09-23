import Foundation

struct EvolutionOverview: Decodable, Sendable {
    let themes: [EvolutionTheme]
    var principles: [EvolutionPrinciple]
    let tensions: [EvolutionTension]
    let timeline: [EvolutionTimelineEntry]
    var reflections: [EvolutionReflection]
    var returnFeedback: [EvolutionReturnFeedback]
    var recentQuestion: EvolutionRecentQuestion?

    static let empty = EvolutionOverview(themes: [], principles: [], tensions: [], timeline: [], reflections: [], returnFeedback: [], recentQuestion: nil)

    var isEmpty: Bool {
        themes.isEmpty && principles.isEmpty && tensions.isEmpty && timeline.isEmpty && reflections.isEmpty && returnFeedback.isEmpty
    }

    private enum CodingKeys: String, CodingKey {
        case themes, principles, tensions, timeline, reflections, returnFeedback, recentQuestion
    }

    init(
        themes: [EvolutionTheme],
        principles: [EvolutionPrinciple],
        tensions: [EvolutionTension],
        timeline: [EvolutionTimelineEntry],
        reflections: [EvolutionReflection],
        returnFeedback: [EvolutionReturnFeedback],
        recentQuestion: EvolutionRecentQuestion?
    ) {
        self.themes = themes
        self.principles = principles
        self.tensions = tensions
        self.timeline = timeline
        self.reflections = reflections
        self.returnFeedback = returnFeedback
        self.recentQuestion = recentQuestion
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        themes = try values.decode([EvolutionTheme].self, forKey: .themes)
        principles = try values.decode([EvolutionPrinciple].self, forKey: .principles)
        tensions = try values.decode([EvolutionTension].self, forKey: .tensions)
        timeline = try values.decode([EvolutionTimelineEntry].self, forKey: .timeline)
        reflections = try values.decodeIfPresent([EvolutionReflection].self, forKey: .reflections) ?? []
        returnFeedback = try values.decodeIfPresent([EvolutionReturnFeedback].self, forKey: .returnFeedback) ?? []
        recentQuestion = try values.decodeIfPresent(EvolutionRecentQuestion.self, forKey: .recentQuestion)
    }
}

struct EvolutionReturnFeedback: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let itemId: String
    let response: String
    let occurredAt: String
}

struct EvolutionRecentQuestion: Decodable, Hashable, Sendable {
    let question: String
    let askedAt: String
}

enum ContextualReturnFeedbackResponse: String, Codable, Sendable {
    case useful
    case notToday = "not_today"
}
