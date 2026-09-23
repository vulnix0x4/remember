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

    static let empty = LifeSnapshot(goals: [], tasks: [], blockers: [], floor: [], events: [], health: [], accounts: [], transactions: [], files: [])
    var activeTask: LifeTask? { tasks.first { $0.status == .active } }
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
