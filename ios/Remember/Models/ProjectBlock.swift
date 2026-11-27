import Foundation

/// A deep-work block on one project. It lives on this device, so reopening the app goes straight back to it.
struct ProjectBlock: Codable, Equatable, Identifiable, Sendable {
    let projectId: UUID
    let startedAt: Date
    let minutes: Int

    var id: String { "\(projectId.uuidString)-\(startedAt.timeIntervalSince1970)" }

    static let defaultMinutes = 60
    static let lengths = [30, 60, 90]
    /// A forgotten block ends by itself after this long.
    static let maxDuration: TimeInterval = 4 * 60 * 60

    var endsAt: Date { startedAt.addingTimeInterval(TimeInterval(minutes * 60)) }

    func isLive(at date: Date = .now) -> Bool { date.timeIntervalSince(startedAt) < Self.maxDuration }

    private static let key = "remember.projectBlock"

    static func load(_ defaults: UserDefaults = .standard) -> ProjectBlock? {
        guard let data = defaults.data(forKey: key),
              let block = try? JSONDecoder().decode(ProjectBlock.self, from: data),
              block.isLive() else { return nil }
        return block
    }

    static func save(_ block: ProjectBlock?, _ defaults: UserDefaults = .standard) {
        if let block, let data = try? JSONEncoder().encode(block) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
