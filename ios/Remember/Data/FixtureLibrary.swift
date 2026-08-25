import Foundation

enum FixtureLibrary {
    static let now = Date(timeIntervalSince1970: Date.now.timeIntervalSince1970.rounded(.down))

    static let imprints: [Imprint] = [
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000001"),
            url: url("https://www.youtube.com/watch?v=meaning1"),
            thumbnailURL: nil,
            sourceType: .youtube,
            title: "Your worst years are not wasted years",
            creator: "The School of Life",
            savedAt: now.addingTimeInterval(-60 * 60 * 24 * 122),
            lifePeriod: "A season of rebuilding",
            essence: "A painful chapter can become material for a more deliberate life without needing to be called good.",
            summary: "The speaker separates finding meaning in hardship from romanticizing it. Growth is framed as attention, reflection, and choosing what to carry forward, not as proof that suffering was necessary.",
            keyIdeas: [
                "Meaning can be made after pain without justifying what happened.",
                "Reflection turns an experience into something usable.",
                "A difficult season can clarify what no longer belongs in your life."
            ],
            moments: [
                KeyMoment(id: UUID(), seconds: 132, title: "Meaning is made afterward", detail: "The central distinction between suffering and what you create from it."),
                KeyMoment(id: UUID(), seconds: 488, title: "Choose what survives", detail: "A practical invitation to name the lesson you want to keep.")
            ],
            themes: ["Rebuilding", "Identity", "Meaning"],
            claims: ["Unprocessed hardship repeats itself as pattern rather than wisdom."],
            candidatePrinciples: ["Let hard periods inform you without letting them define you."],
            experiments: ["Write one thing this season clarified, and one thing you are ready to release."],
            personalHypotheses: ["This may have resonated because you were looking for evidence that a difficult period could still become useful."],
            uncertainties: ["No personal reaction was recorded, so relevance is inferred from the source and save date."],
            connections: [
                Connection(id: UUID(), itemID: uuid("10000000-0000-0000-0000-000000000002"), type: .supports, title: "The courage to be disliked", explanation: "Both distinguish choosing your response from controlling what happened.")
            ],
            state: .ready,
            reaction: nil
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000002"),
            url: url("https://www.youtube.com/watch?v=courage2"),
            thumbnailURL: nil,
            sourceType: .youtube,
            title: "The courage to be disliked",
            creator: "Einzelgänger",
            savedAt: now.addingTimeInterval(-60 * 60 * 24 * 93),
            lifePeriod: "Learning independence",
            essence: "Freedom grows when you stop making other people’s approval the measure of a good choice.",
            summary: "An introduction to separating your responsibilities from the expectations of other people, while preserving care and connection.",
            keyIdeas: ["Not every opinion about you is yours to manage.", "Belonging and self-erasure are not the same."],
            moments: [KeyMoment(id: UUID(), seconds: 361, title: "Separate the tasks", detail: "A framework for deciding which expectations belong to whom.")],
            themes: ["Independence", "Relationships", "Identity"],
            claims: ["Approval seeking trades present comfort for long-term resentment."],
            candidatePrinciples: ["Care about people without outsourcing your direction to them."],
            experiments: ["Before one decision, ask whose task the outcome really is."],
            personalHypotheses: ["You may have been renegotiating how much weight to give other people’s expectations."],
            uncertainties: ["The source simplifies a broad psychological framework."],
            connections: [],
            state: .ready,
            reaction: "I want to remember the difference between being kind and being controlled."
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000003"),
            url: url("https://www.youtube.com/watch?v=attention3"),
            thumbnailURL: nil,
            sourceType: .youtube,
            title: "Protect your attention like a resource",
            creator: "The Knowledge Project",
            savedAt: now.addingTimeInterval(-60 * 60 * 24 * 45),
            lifePeriod: "Building with focus",
            essence: "Your attention becomes your life in aggregate, so deciding what not to pursue is a form of authorship.",
            summary: "A conversation about attention, opportunity cost, and the discipline required to leave attractive possibilities unexplored.",
            keyIdeas: ["Opportunity cost is emotional, not only economic.", "Focus requires grieving paths you will not take."],
            moments: [KeyMoment(id: UUID(), seconds: 742, title: "The cost of every yes", detail: "Why attractive options can still be distractions.")],
            themes: ["Purpose", "Building", "Attention"],
            claims: ["A meaningful life depends on deliberate exclusion."],
            candidatePrinciples: ["Treat attention as evidence of what you value."],
            experiments: ["Remove one recurring input that does not deserve a place in your week."],
            personalHypotheses: ["This may connect to a desire to build something ambitious without fragmenting your energy."],
            uncertainties: [],
            connections: [Connection(id: UUID(), itemID: uuid("10000000-0000-0000-0000-000000000004"), type: .contradicts, title: "Stay open to unexpected paths", explanation: "One argues for aggressive exclusion; the other sees unplanned exploration as essential.")],
            state: .ready,
            reaction: nil
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000004"),
            url: url("https://www.youtube.com/watch?v=serendipity4"),
            thumbnailURL: nil,
            sourceType: .youtube,
            title: "Stay open to unexpected paths",
            creator: "On Being",
            savedAt: now.addingTimeInterval(-60 * 60 * 24 * 33),
            lifePeriod: "Making room for uncertainty",
            essence: "A life planned too tightly can become unable to receive what you could not have predicted.",
            summary: "The conversation makes a case for receptivity and the creative possibilities that appear outside a fixed plan.",
            keyIdeas: ["Uncertainty is also possibility.", "Serendipity needs unallocated space."],
            moments: [KeyMoment(id: UUID(), seconds: 905, title: "Leave a door open", detail: "The relationship between structure and surprise.")],
            themes: ["Uncertainty", "Purpose", "Creativity"],
            claims: ["Over-optimization can reduce the range of futures you can encounter."],
            candidatePrinciples: ["Keep enough structure to move and enough space to notice."],
            experiments: ["Protect one hour this week without deciding its use in advance."],
            personalHypotheses: ["This may have softened an impulse to make every hour productive."],
            uncertainties: [],
            connections: [],
            state: .ready,
            reaction: nil
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000005"),
            url: url("https://www.youtube.com/watch?v=process5"),
            thumbnailURL: nil,
            sourceType: .youtube,
            title: "How ideas become real",
            creator: "Creative Process",
            savedAt: now.addingTimeInterval(-60 * 60 * 3),
            lifePeriod: "Now",
            essence: "Understanding the source and identifying the ideas that might stay with you.",
            summary: "Processing is still underway.",
            keyIdeas: [], moments: [], themes: ["Building"], claims: [], candidatePrinciples: [], experiments: [], personalHypotheses: [], uncertainties: [], connections: [], state: .processing, reaction: nil
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000006"),
            url: url("https://example.com/unavailable"),
            thumbnailURL: nil,
            sourceType: .web,
            title: "A link waiting for another try",
            creator: "Unknown source",
            savedAt: now.addingTimeInterval(-60 * 25),
            lifePeriod: "Now",
            essence: "This source could not be analyzed yet, but the original link is safe.",
            summary: "Remember will preserve the source even when understanding fails.",
            keyIdeas: [], moments: [], themes: [], claims: [], candidatePrinciples: [], experiments: [], personalHypotheses: [], uncertainties: ["The source did not respond during analysis."], connections: [], state: .failed, reaction: nil
        )
    ]

    private static func uuid(_ value: String) -> UUID {
        guard let uuid = UUID(uuidString: value) else { fatalError("Invalid fixture UUID: \(value)") }
        return uuid
    }

    private static func url(_ value: String) -> URL {
        guard let url = URL(string: value) else { fatalError("Invalid fixture URL: \(value)") }
        return url
    }
}
