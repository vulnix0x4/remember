@preconcurrency import EventKit
import Foundation

enum CalendarSyncError: LocalizedError {
    case accessDenied
    var errorDescription: String? { "Full Calendar access was not granted." }
}

@MainActor
final class CalendarSyncService {
    private let store = EKEventStore()

    func readApprovedEvents(pastDays: Int = 30, futureDays: Int = 365) async throws -> [CalendarEventUpload] {
        guard try await store.requestFullAccessToEvents() else { throw CalendarSyncError.accessDenied }
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .day, value: -pastDays, to: .now) ?? .distantPast
        let end = calendar.date(byAdding: .day, value: futureDays, to: .now) ?? .distantFuture
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: predicate)
            .sorted { $0.startDate < $1.startDate }
            .map { event in
                CalendarEventUpload(
                    externalId: event.eventIdentifier,
                    source: "apple",
                    calendarName: event.calendar.title,
                    title: event.title ?? "Untitled event",
                    notes: event.notes ?? "",
                    location: event.location ?? "",
                    url: event.url,
                    startAt: event.startDate,
                    endAt: event.endDate,
                    allDay: event.isAllDay,
                    status: event.status == .canceled ? "cancelled" : event.status == .tentative ? "tentative" : "confirmed"
                )
            }
    }
}
