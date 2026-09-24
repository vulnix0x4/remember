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
            reaction: nil,
            returnCue: .stuck
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
            reaction: "I want to remember the difference between being kind and being controlled.",
            returnCue: .decision
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
            reaction: nil,
            returnCue: .focus
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
            essence: "Saved safely. Analysis is still in progress.",
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
            summary: "The original link stays safe even when analysis fails.",
            keyIdeas: [], moments: [], themes: [], claims: [], candidatePrinciples: [], experiments: [], personalHypotheses: [], uncertainties: ["The source did not respond during analysis."], connections: [], state: .failed, reaction: nil
        ),
        Imprint(
            id: uuid("10000000-0000-0000-0000-000000000007"),
            url: url("remember://thought/10000000-0000-0000-0000-000000000007"),
            thumbnailURL: nil,
            sourceType: .note,
            title: "The first quiet hour is where I can hear myself think",
            creator: "You",
            savedAt: now.addingTimeInterval(-60 * 60 * 8),
            lifePeriod: "Noticing how my days begin",
            essence: "Protecting the first quiet hour may be less about productivity and more about choosing whether the day begins from intention or reaction.",
            summary: "This thought connects the shape of the morning to the shape of attention. It suggests that early messages do not merely consume time—they set a reactive posture that can continue for the rest of the day.",
            keyIdeas: [
                "The first hour creates the emotional posture of the day.",
                "Giving quiet away early can make the rest of the day feel reactive."
            ],
            moments: [],
            themes: ["Attention", "Focus", "Intentionality"],
            claims: ["Early inputs can set a reactive pattern for the rest of the day."],
            candidatePrinciples: ["Let the day begin with your attention before borrowing someone else’s urgency."],
            experiments: ["Keep messages closed for the first quiet hour tomorrow and notice what becomes easier to hear."],
            personalHypotheses: ["You may be noticing that the quality of your attention depends on how deliberately the day begins."],
            uncertainties: ["One thought is a signal, not proof that every morning works the same way."],
            connections: [
                Connection(
                    id: UUID(),
                    itemID: uuid("10000000-0000-0000-0000-000000000003"),
                    type: .supports,
                    title: "Protect your attention like a resource",
                    explanation: "Your own observation gives the saved idea a concrete place in daily life."
                )
            ],
            state: .ready,
            reaction: nil,
            analysisScope: "thought",
            returnCue: .focus,
            noteText: "The first quiet hour is where I can hear myself think. If I give it away to messages, I spend the rest of the day reacting."
        )
    ]

    static let evolutionOverview = EvolutionOverview(
        themes: [],
        principles: [
            EvolutionPrinciple(
                id: "30000000-0000-0000-0000-000000000001",
                itemId: "10000000-0000-0000-0000-000000000003",
                text: "Treat attention as evidence of what you value.",
                rationale: "This idea has stayed connected to how you want to build.",
                status: "active",
                createdAt: "2026-08-22T12:00:00Z"
            ),
            EvolutionPrinciple(
                id: "30000000-0000-0000-0000-000000000002",
                itemId: "10000000-0000-0000-0000-000000000001",
                text: "Let hard periods inform you without letting them define you.",
                rationale: "Remember noticed this idea in a save about rebuilding.",
                status: "candidate",
                createdAt: "2026-08-23T12:00:00Z"
            ),
        ],
        tensions: [
            EvolutionTension(
                id: "40000000-0000-0000-0000-000000000001",
                fromItemId: "10000000-0000-0000-0000-000000000003",
                toItemId: "10000000-0000-0000-0000-000000000004",
                explanation: "Protecting your focus and staying open to an unexpected path can both matter. The unresolved question is when each one deserves to lead.",
                confidence: 0.88
            )
        ],
        timeline: [],
        reflections: [
            EvolutionReflection(
                id: "50000000-0000-0000-0000-000000000001",
                itemId: "10000000-0000-0000-0000-000000000002",
                response: "not_sure",
                occurredAt: "2026-08-29T12:00:00Z"
            )
        ],
        returnFeedback: [],
        recentQuestion: nil
    )

    static let lifeSnapshot: LifeSnapshot = {
        let queued = LifeTask(
            id: uuid("60000000-0000-0000-0000-000000000001"),
            goalId: nil,
            title: "Remove one recurring input that does not deserve a place in your week",
            firstStep: "Choose the first input to remove.",
            notes: CarryForwardPlan.notes(for: imprints[2]),
            area: .growth,
            status: .queued,
            priority: .normal,
            energy: .any,
            durationMinutes: 15,
            dueAt: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            source: "practice",
            completedAt: nil,
            createdAt: now.addingTimeInterval(-86_400),
            updatedAt: now.addingTimeInterval(-86_400)
        )
        let completed = LifeTask(
            id: uuid("60000000-0000-0000-0000-000000000002"),
            goalId: nil,
            title: "Name one thing this season clarified",
            firstStep: "Write one honest sentence.",
            notes: CarryForwardPlan.notes(for: imprints[0]),
            area: .growth,
            status: .done,
            priority: .normal,
            energy: .any,
            durationMinutes: 15,
            dueAt: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            source: "practice",
            sourceItemId: imprints[0].id,
            practiceOutcome: .helped,
            practiceReflection: "Writing it down made the next step feel obvious.",
            reflectedAt: now.addingTimeInterval(-172_800),
            completedAt: now.addingTimeInterval(-172_800),
            createdAt: now.addingTimeInterval(-259_200),
            updatedAt: now.addingTimeInterval(-172_800)
        )
        func everyday(_ id: String, _ title: String, minutes: Int, priority: LifeTaskPriority = .normal, notBefore: Date? = nil, dueAt: Date? = nil, repeatEveryDays: Int? = nil) -> LifeTask {
            LifeTask(
                id: uuid(id), goalId: nil, title: title, firstStep: "", notes: "", area: .direction,
                status: .queued, priority: priority, energy: .any, durationMinutes: minutes, dueAt: dueAt,
                scheduledStart: nil, scheduledEnd: nil, source: "manual", completedAt: nil,
                createdAt: now.addingTimeInterval(-3_600), updatedAt: now.addingTimeInterval(-3_600),
                repeatEveryDays: repeatEveryDays, notBefore: notBefore
            )
        }
        let calendar = Calendar.current
        let tomorrowMorning = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: calendar.date(byAdding: .day, value: 1, to: .now)!)!
        let inThreeDays = calendar.date(bySettingHour: 17, minute: 0, second: 0, of: calendar.date(byAdding: .day, value: 3, to: .now)!)!
        let everydayTasks = [
            everyday("60000000-0000-0000-0000-000000000003", "Reply to Sam about Saturday", minutes: 5, priority: .high),
            everyday("60000000-0000-0000-0000-000000000004", "Laundry", minutes: 45, repeatEveryDays: 7),
            everyday("60000000-0000-0000-0000-000000000005", "Pay rent", minutes: 10, dueAt: inThreeDays),
            everyday("60000000-0000-0000-0000-000000000006", "Book a dentist appointment", minutes: 10, notBefore: tomorrowMorning),
        ]
        let habits = [("Drink water", "glasses", 8), ("Walk outside", "minutes", 20), ("Take meds", "dose", 1)].enumerated().map { index, habit in
            LifeFloorItem(
                id: uuid("70000000-0000-0000-0000-00000000000\(index + 1)"), title: habit.0, area: .health,
                target: habit.2, unit: habit.1, completionDates: index == 2 ? [.now] : [],
                createdAt: now, updatedAt: now
            )
        }
        let laundryRoutine = Commitment(
            id: uuid("80000000-0000-0000-0000-000000000001"), title: "Laundry", kind: .chore, days: 127, everyDays: 7,
            fixedStart: nil, durationMinutes: 30, importance: .high, steps: CommitmentTemplates.laundrySteps,
            notes: "", active: true, createdAt: now, updatedAt: now
        )
        let college = Commitment(
            id: uuid("80000000-0000-0000-0000-000000000002"), title: "College study", kind: .commitment, days: 127, everyDays: nil,
            fixedStart: nil, durationMinutes: 120, importance: .must, steps: [], notes: "", active: true, createdAt: now, updatedAt: now
        )
        var linkedTasks = everydayTasks
        linkedTasks[1].commitmentId = laundryRoutine.id
        var snapshot = LifeSnapshot.empty
        snapshot.tasks = [queued, completed] + linkedTasks
        snapshot.floor = habits
        snapshot.commitments = [college, laundryRoutine]
        return snapshot
    }()

    private static func uuid(_ value: String) -> UUID {
        guard let uuid = UUID(uuidString: value) else { fatalError("Invalid fixture UUID: \(value)") }
        return uuid
    }

    private static func url(_ value: String) -> URL {
        guard let url = URL(string: value) else { fatalError("Invalid fixture URL: \(value)") }
        return url
    }
}
