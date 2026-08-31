import SwiftUI

struct LifeCalendarView: View {
    @Environment(AppStore.self) private var store
    private let calendarService = CalendarSyncService()
    @State private var selectedDate = Date.now

    private var selectedEvents: [LifeCalendarEvent] {
        store.lifeSnapshot.events
            .filter { Calendar.current.isDate($0.startAt, inSameDayAs: selectedDate) && $0.status != "cancelled" }
            .sorted { $0.startAt < $1.startAt }
    }

    private var week: [Date] {
        (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: Calendar.current.startOfDay(for: .now)) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("TIME").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                                Text("Calendar meets intention.").font(.largeTitle.bold())
                                Text("Commitments and next moves share the same day.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                            }
                            Spacer()
                            Button("Sync", systemImage: "arrow.triangle.2.circlepath") { sync() }
                                .buttonStyle(.borderedProminent)
                                .buttonBorderShape(.capsule)
                                .tint(RememberDesign.accent)
                                .foregroundStyle(RememberDesign.accentInk)
                                .disabled(store.isSyncingCalendar)
                        }
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(week, id: \.self) { day in
                                    Button {
                                        selectedDate = day
                                    } label: {
                                        VStack(spacing: 6) {
                                            Text(day.formatted(.dateTime.weekday(.abbreviated))).font(.caption2.bold())
                                            Text(day.formatted(.dateTime.day())).font(.title2.bold())
                                            Circle().fill(hasEvents(on: day) ? RememberDesign.accent : .clear).frame(width: 4, height: 4)
                                        }
                                        .frame(width: 54, height: 72)
                                        .background(Calendar.current.isDate(day, inSameDayAs: selectedDate) ? RememberDesign.accent.opacity(0.14) : RememberDesign.surface, in: RoundedRectangle(cornerRadius: 14))
                                        .overlay { RoundedRectangle(cornerRadius: 14).stroke(Calendar.current.isDate(day, inSameDayAs: selectedDate) ? RememberDesign.accent.opacity(0.45) : RememberDesign.line) }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(selectedDate.formatted(.dateTime.weekday(.wide))).font(.caption.bold()).foregroundStyle(RememberDesign.accent)
                            Text(selectedDate.formatted(.dateTime.month(.wide).day())).font(.title.bold())
                        }
                        if selectedEvents.isEmpty {
                            ContentUnavailableView("Nothing scheduled", systemImage: "calendar", description: Text("Open time is useful. Protect it deliberately or leave it open on purpose."))
                                .frame(maxWidth: .infinity, minHeight: 260)
                                .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                        } else {
                            VStack(spacing: 0) {
                                ForEach(selectedEvents) { event in
                                    HStack(spacing: 14) {
                                        Text(event.allDay ? "All day" : event.startAt.formatted(date: .omitted, time: .shortened))
                                            .font(.caption.monospacedDigit())
                                            .foregroundStyle(RememberDesign.secondaryText)
                                            .frame(width: 58, alignment: .leading)
                                        Circle().fill(color(for: event.source)).frame(width: 8, height: 8)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(event.title).font(.subheadline.bold())
                                            Text([event.location, event.calendarName].filter { !$0.isEmpty }.joined(separator: " · "))
                                                .font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                        }
                                        Spacer()
                                    }
                                    .padding(.vertical, 15)
                                    Divider().overlay(RememberDesign.line)
                                }
                            }
                        }
                        Label {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Full Calendar access is optional").font(.subheadline.bold()).foregroundStyle(.primary)
                                Text("Remember requests access only when you tap Sync. You can revoke it in Settings at any time.").font(.caption).foregroundStyle(RememberDesign.secondaryText)
                            }
                        } icon: { Image(systemName: "lock.shield").foregroundStyle(RememberDesign.accent) }
                        .padding(18)
                        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 17))
                    }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, 96)
                }
                .refreshable { await store.loadLife() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func sync() {
        Task {
            do { await store.syncCalendar(try await calendarService.readApprovedEvents()) }
            catch {
                store.errorMessage = error.localizedDescription
                store.errorIsPresented = true
            }
        }
    }

    private func hasEvents(on day: Date) -> Bool { store.lifeSnapshot.events.contains { Calendar.current.isDate($0.startAt, inSameDayAs: day) } }
    private func color(for source: String) -> Color {
        switch source { case "apple": .red; case "google": .blue; case "outlook": .cyan; case "task": RememberDesign.danger; default: RememberDesign.accent }
    }
}
