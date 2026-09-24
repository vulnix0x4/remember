import Foundation

enum LifeArea: String, Codable, CaseIterable, Hashable, Sendable {
    case health, work, relationships, environment, money, growth, direction

    var label: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .health: "heart.text.square"
        case .work: "hammer"
        case .relationships: "person.2"
        case .environment: "house"
        case .money: "wallet.bifold"
        case .growth: "leaf"
        case .direction: "location.north"
        }
    }
}

enum LifeTaskStatus: String, Codable, Hashable, Sendable { case inbox, queued, active, waiting, done, removed }
enum LifeTaskPriority: String, Codable, CaseIterable, Hashable, Sendable { case low, normal, high, must }
enum LifeTaskEnergy: String, Codable, CaseIterable, Hashable, Sendable { case low, medium, high, any }
enum PracticeOutcome: String, Codable, CaseIterable, Hashable, Sendable {
    case helped, mixed, notForMe = "not_for_me"

    var label: String {
        switch self {
        case .helped: "It helped"
        case .mixed: "Somewhat"
        case .notForMe: "Not for me"
        }
    }

    var meaning: String {
        switch self {
        case .helped: "I want to carry this forward"
        case .mixed: "Part of it worked"
        case .notForMe: "Trying it helped me let it go"
        }
    }
}
enum LifeBlockerReason: String, Codable, CaseIterable, Hashable, Sendable {
    case big, unclear, time, place, irrelevant, different
    var label: String {
        switch self {
        case .big: "It’s too big"
        case .unclear: "It’s unclear"
        case .time: "I don’t have time"
        case .place: "I’m in the wrong place"
        case .irrelevant: "This no longer matters"
        case .different: "Something else matters"
        }
    }
}

struct LifeGoal: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var area: LifeArea
    var vision: String
    var why: String
    var status: String
    var progress: Int
    var targetDate: Date?
    var createdAt: Date
    var updatedAt: Date
}

struct LifeTask: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var goalId: UUID?
    var title: String
    var firstStep: String
    var notes: String
    var area: LifeArea
    var status: LifeTaskStatus
    var priority: LifeTaskPriority
    var energy: LifeTaskEnergy
    var durationMinutes: Int
    var dueAt: Date?
    var scheduledStart: Date?
    var scheduledEnd: Date?
    var source: String
    var sourceItemId: UUID? = nil
    var practiceOutcome: PracticeOutcome? = nil
    var practiceReflection: String? = nil
    var reflectedAt: Date? = nil
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var repeatEveryDays: Int? = nil
    var notBefore: Date? = nil
    /// Set when this task is one day's occurrence of a commitment or chore.
    var commitmentId: UUID? = nil
    var occurrenceDate: String? = nil
    /// Minutes the focus timer actually ran, recorded on completion.
    var actualMinutes: Int? = nil
}

enum CommitmentKind: String, Codable, CaseIterable, Hashable, Sendable { case commitment, chore }

enum CommitmentImportance: String, Codable, CaseIterable, Hashable, Sendable {
    case must, high, normal

    var label: String {
        switch self {
        case .must: "Must do"
        case .high: "Important"
        case .normal: "Nice to do"
        }
    }

    var detail: String {
        switch self {
        case .must: "Always planned, first"
        case .high: "Planned when there's room"
        case .normal: "Fits into open time"
        }
    }
}

struct RoutineStep: Codable, Hashable, Sendable, Identifiable {
    var id = UUID()
    var title: String
    /// Hands-off time, like a washer running. The app times it and nudges when it ends.
    var waitMinutes: Int?

    private enum CodingKeys: String, CodingKey { case title, waitMinutes }

    init(title: String, waitMinutes: Int? = nil) {
        self.title = title
        self.waitMinutes = waitMinutes
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decode(String.self, forKey: .title)
        waitMinutes = try container.decodeIfPresent(Int.self, forKey: .waitMinutes)
    }
}

/// Something that recurs on its own and is planned with everything else:
/// a commitment (college study, gym) or a chore (laundry).
struct Commitment: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var kind: CommitmentKind
    /// Weekdays as a bitmask: Sunday = 1, Monday = 2 … Saturday = 64.
    var days: Int
    /// For chores: repeat this many days after the last time it was done.
    var everyDays: Int?
    /// "HH:MM" local time, or nil to let Jev choose.
    var fixedStart: String?
    var durationMinutes: Int
    var importance: CommitmentImportance
    var steps: [RoutineStep]
    var notes: String
    var active: Bool
    var createdAt: Date
    var updatedAt: Date
}

/// The editable fields of a commitment, used for create and update.
struct CommitmentDraft: Encodable, Hashable, Sendable {
    var title: String
    var kind: CommitmentKind
    var days: Int = 127
    var everyDays: Int?
    var fixedStart: String?
    var durationMinutes: Int = 60
    var importance: CommitmentImportance = .high
    var steps: [RoutineStep] = []
    var notes: String = ""
    var active = true

    private enum CodingKeys: String, CodingKey { case title, kind, days, everyDays, fixedStart, durationMinutes, importance, steps, notes, active }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encode(kind, forKey: .kind)
        try container.encode(days, forKey: .days)
        try container.encode(everyDays, forKey: .everyDays)
        try container.encode(fixedStart, forKey: .fixedStart)
        try container.encode(durationMinutes, forKey: .durationMinutes)
        try container.encode(importance, forKey: .importance)
        try container.encode(steps, forKey: .steps)
        try container.encode(notes, forKey: .notes)
        try container.encode(active, forKey: .active)
    }

    init(title: String, kind: CommitmentKind, days: Int = 127, everyDays: Int? = nil, fixedStart: String? = nil, durationMinutes: Int = 60, importance: CommitmentImportance = .high, steps: [RoutineStep] = []) {
        self.title = title
        self.kind = kind
        self.days = days
        self.everyDays = everyDays
        self.fixedStart = fixedStart
        self.durationMinutes = durationMinutes
        self.importance = importance
        self.steps = steps
    }

    init(_ commitment: Commitment) {
        self.init(title: commitment.title, kind: commitment.kind, days: commitment.days, everyDays: commitment.everyDays,
                  fixedStart: commitment.fixedStart, durationMinutes: commitment.durationMinutes,
                  importance: commitment.importance, steps: commitment.steps)
        notes = commitment.notes
        active = commitment.active
    }
}

struct LifeBlockerEvent: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let taskId: UUID
    let taskTitle: String
    let reason: LifeBlockerReason
    let originalDuration: Int
    let createdAt: Date
}

struct LifeFloorItem: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var area: LifeArea
    var target: Int
    var unit: String
    var completionDates: [Date]
    var createdAt: Date
    var updatedAt: Date
}

struct LifeCalendarEvent: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var externalId: String?
    var source: String
    var calendarName: String
    var title: String
    var notes: String
    var location: String
    var url: URL?
    var startAt: Date
    var endAt: Date
    var allDay: Bool
    var status: String
    var createdAt: Date
    var updatedAt: Date
}

struct LifeHealthMetric: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var externalId: String?
    var type: String
    var value: Double
    var unit: String
    var startAt: Date
    var endAt: Date
    var source: String
    var metadata: [String: String]
    var createdAt: Date
}

struct LifeFinanceAccount: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var externalId: String?
    var name: String
    var institution: String
    var type: String
    var balance: Double
    var currency: String
    var source: String
    var lastSyncedAt: Date?
    var createdAt: Date
    var updatedAt: Date
}

struct LifeFinanceTransaction: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var accountId: UUID?
    var externalId: String?
    var name: String
    var merchant: String
    var amount: Double
    var currency: String
    var category: String
    var occurredAt: Date
    var status: String
    var notes: String
    var createdAt: Date
    var updatedAt: Date
}

struct LifeVaultFile: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var mimeType: String
    var sizeBytes: Int
    var folder: String
    var tags: [String]
    var summary: String
    var createdAt: Date
    var updatedAt: Date
}

struct LifeSnapshot: Codable, Hashable, Sendable {
    var goals: [LifeGoal]
    var tasks: [LifeTask]
    var blockers: [LifeBlockerEvent]
    var floor: [LifeFloorItem]
    var events: [LifeCalendarEvent]
    var health: [LifeHealthMetric]
    var accounts: [LifeFinanceAccount]
    var transactions: [LifeFinanceTransaction]
    var files: [LifeVaultFile]
    var commitments: [Commitment]? = nil

    static let empty = LifeSnapshot(goals: [], tasks: [], blockers: [], floor: [], events: [], health: [], accounts: [], transactions: [], files: [])
    var activeTask: LifeTask? { tasks.first { $0.status == .active } }
    var allCommitments: [Commitment] { commitments ?? [] }

    func commitment(for task: LifeTask) -> Commitment? {
        guard let id = task.commitmentId else { return nil }
        return allCommitments.first { $0.id == id }
    }
}

struct CreateLifeTaskRequest: Encodable, Sendable {
    let title: String
    let firstStep: String
    let notes: String
    let area: LifeArea
    let status: LifeTaskStatus
    let priority: LifeTaskPriority
    let energy: LifeTaskEnergy
    let durationMinutes: Int
    let goalId: UUID?
    let source: String
    let sourceItemId: UUID?
    var repeatEveryDays: Int? = nil
    var dueAt: Date? = nil
    var notBefore: Date? = nil
}

/// A partial task update. Double optionals distinguish "leave unchanged" (nil) from "clear" (.some(nil)).
struct LifeTaskPatch: Encodable, Sendable, Equatable {
    var title: String?
    var firstStep: String?
    var status: LifeTaskStatus?
    var priority: LifeTaskPriority?
    var durationMinutes: Int?
    var notBefore: Date??
    var dueAt: Date??
    var repeatEveryDays: Int??

    private enum CodingKeys: String, CodingKey {
        case title, firstStep, status, priority, durationMinutes, notBefore, dueAt, repeatEveryDays
    }

    var isEmpty: Bool { self == LifeTaskPatch() }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(firstStep, forKey: .firstStep)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(priority, forKey: .priority)
        try container.encodeIfPresent(durationMinutes, forKey: .durationMinutes)
        if let notBefore { try container.encode(notBefore, forKey: .notBefore) }
        if let dueAt { try container.encode(dueAt, forKey: .dueAt) }
        if let repeatEveryDays { try container.encode(repeatEveryDays, forKey: .repeatEveryDays) }
    }

    func applied(to task: LifeTask) -> LifeTask {
        var task = task
        if let title { task.title = title }
        if let firstStep { task.firstStep = firstStep }
        if let status { task.status = status }
        if let priority { task.priority = priority }
        if let durationMinutes { task.durationMinutes = durationMinutes }
        if let notBefore { task.notBefore = notBefore }
        if let dueAt { task.dueAt = dueAt }
        if let repeatEveryDays { task.repeatEveryDays = repeatEveryDays }
        task.updatedAt = .now
        return task
    }
}

struct PracticeResult: Codable, Hashable, Sendable {
    let outcome: PracticeOutcome
    let reflection: String
}

struct CreateLifeGoalRequest: Encodable, Sendable {
    let title: String
    let area: LifeArea
    let vision: String
    let why: String
}

struct CreateLifeFloorRequest: Encodable, Sendable {
    let title: String
    let area: LifeArea
    let target: Int
    let unit: String
}

struct HealthMetricUpload: Encodable, Sendable {
    let externalId: String?
    let type: String
    let value: Double
    let unit: String
    let startAt: Date
    let endAt: Date
    let source: String
    let metadata: [String: String]
}

struct CalendarEventUpload: Encodable, Sendable {
    let externalId: String?
    let source: String
    let calendarName: String
    let title: String
    let notes: String
    let location: String
    let url: URL?
    let startAt: Date
    let endAt: Date
    let allDay: Bool
    let status: String
}

struct FinanceAccountUpload: Encodable, Sendable {
    let externalId: String
    let name: String
    let institution: String
    let type: String
    let balance: Double
    let currency: String
    let source: String
    let lastSyncedAt: Date
}

struct FinanceTransactionUpload: Encodable, Sendable {
    let accountId: UUID?
    let externalId: String
    let name: String
    let merchant: String
    let amount: Double
    let currency: String
    let category: String
    let occurredAt: Date
    let status: String
    let notes: String
}
