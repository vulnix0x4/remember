import SwiftUI

struct LifeCalendarView: View {
    @Environment(AppStore.self) private var store
    @Binding private var planSection: PlanSection
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let calendarService = CalendarSyncService()
    @State private var selectedDate = Date.now

    init(planSection: Binding<PlanSection> = .constant(.calendar)) {
        _planSection = planSection
    }

    private var selectedEvents: [LifeCalendarEvent] {
        store.lifeSnapshot.events
            .filter { Calendar.current.isDate($0.startAt, inSameDayAs: selectedDate) && $0.status != "cancelled" }
            .sorted { $0.startAt < $1.startAt }
    }

    private var plannedTasks: [BrainBlock] {
        let open = Set(store.lifeSnapshot.tasks.filter { [.active, .queued, .inbox].contains($0.status) }.map(\.id))
        return (store.brain?.plan ?? []).filter { open.contains($0.taskId) && Calendar.current.isDate($0.startAt, inSameDayAs: selectedDate) }
    }

    private var week: [Date] {
        let start = Calendar.current.dateInterval(of: .weekOfYear, for: selectedDate)?.start
            ?? Calendar.current.startOfDay(for: selectedDate)
        return (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: start) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $planSection,
                    choices: PlanSection.allCases,
                    accessibilityIdentifier: "remember.section.plan",
                    title: { $0.rawValue }
                )
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    weekNavigation

                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedDate.formatted(.dateTime.weekday(.wide)))
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                        Text(selectedDate.formatted(.dateTime.month(.wide).day()))
                            .font(.title2.bold())
                    }

                    if !plannedTasks.isEmpty {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            SectionHeading(title: "Planned by Jev")
                            ForEach(plannedTasks) { block in
                                HStack(spacing: RememberDesign.spacingCompact) {
                                    Capsule().fill(RememberDesign.accent).frame(width: 4)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(block.startAt, style: .time)
                                            .font(.rememberMeta)
                                            .foregroundStyle(RememberDesign.accent)
                                        Text(block.title).font(.rememberRowTitle)
                                        if !block.reason.isEmpty {
                                            Text(block.reason)
                                                .font(.footnote)
                                                .foregroundStyle(RememberDesign.text2)
                                                .lineLimit(2)
                                        }
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(RememberDesign.spacing)
                                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                            }
                        }
                    }

                    if store.lifeSnapshot.events.isEmpty && store.lastCalendarSync == nil {
                        RememberEmptyState(
                            systemImage: "calendar",
                            title: "See your events here",
                            message: "Jev plans around what you already have.",
                            actionTitle: store.isSyncingCalendar ? "Connecting…" : "Connect calendar",
                            action: sync
                        )
                        .disabled(store.isSyncingCalendar)
                    } else if selectedEvents.isEmpty && plannedTasks.isEmpty {
                        RememberEmptyState(systemImage: "sun.max", title: "Nothing scheduled", message: "This day is open.")
                    } else if !selectedEvents.isEmpty {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            SectionHeading(title: "Events")
                            VStack(spacing: 0) {
                                ForEach(selectedEvents) { event in
                                    eventRow(event)
                                    if event.id != selectedEvents.last?.id {
                                        Divider().overlay(RememberDesign.line).padding(.leading, 72)
                                    }
                                }
                            }
                            .padding(.horizontal, RememberDesign.spacing)
                            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                        }
                    }

                    if !store.lifeSnapshot.events.isEmpty || store.lastCalendarSync != nil {
                        Button {
                            sync()
                        } label: {
                            Label(store.isSyncingCalendar ? "Syncing…" : "Sync calendar", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .buttonStyle(.rememberQuiet)
                        .disabled(store.isSyncingCalendar)
                        .frame(maxWidth: .infinity)
                        if let lastSync = store.lastCalendarSync {
                            Text("Last synced \(lastSync.formatted(.relative(presentation: .named)))")
                                .font(.footnote)
                                .foregroundStyle(RememberDesign.text3)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
                    .padding(RememberDesign.spacing)
                    .padding(.bottom, RememberDesign.spacingXLarge)
                }
                .refreshable { await store.loadLife() }
            }
            .rememberBottomDock {
                AddBar(placeholder: "Add a task…", parsesTasks: true, accessibilityIdentifier: "remember.task.quickAdd") {
                    await store.quickAddTask($0)
                }
            }
            .rememberPrimaryActions()
        }
    }

    private var weekNavigation: some View {
        VStack(spacing: RememberDesign.spacingSmall) {
            HStack {
                Button("Previous week", systemImage: "chevron.left") {
                    moveWeek(by: -1)
                }
                .labelStyle(.iconOnly)
                .frame(minWidth: 44, minHeight: 44)

                Spacer()

                DatePicker("Choose date", selection: $selectedDate, displayedComponents: .date)
                    .labelsHidden()

                Spacer()

                Button("Next week", systemImage: "chevron.right") {
                    moveWeek(by: 1)
                }
                .labelStyle(.iconOnly)
                .frame(minWidth: 44, minHeight: 44)
            }

            HStack(spacing: 6) {
                ForEach(week, id: \.self) { day in
                    Button {
                        selectedDate = day
                    } label: {
                        VStack(spacing: 5) {
                            Text(day.formatted(.dateTime.weekday(.narrow)))
                                .font(.caption)
                            Text(day.formatted(.dateTime.day()))
                                .font(.headline.monospacedDigit())
                            Circle()
                                .fill(hasEvents(on: day) ? RememberDesign.accent : .clear)
                                .frame(width: 4, height: 4)
                        }
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .foregroundStyle(Calendar.current.isDate(day, inSameDayAs: selectedDate) ? RememberDesign.canvas : .white)
                        .background(
                            Calendar.current.isDate(day, inSameDayAs: selectedDate) ? Color.white : .clear,
                            in: .rect(cornerRadius: RememberDesign.controlRadius)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(day.formatted(date: .complete, time: .omitted))
                    .accessibilityValue(hasEvents(on: day) ? "Has events" : "No events")
                }
            }
        }
    }

    private func eventRow(_ event: LifeCalendarEvent) -> some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    eventTime(event)
                    HStack(alignment: .top, spacing: 12) {
                        eventSourceIcon(event)
                        eventDetails(event)
                        Spacer()
                    }
                }
            } else {
                HStack(alignment: .top, spacing: 12) {
                    eventTime(event)
                        .frame(width: 58, alignment: .leading)
                    eventSourceIcon(event)
                    eventDetails(event)
                    Spacer()
                }
            }
        }
        .frame(minHeight: 64)
        .accessibilityElement(children: .combine)
    }

    private func eventTime(_ event: LifeCalendarEvent) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(event.allDay ? "All day" : event.startAt.formatted(date: .omitted, time: .shortened))
                .font(.subheadline.monospacedDigit())
            if !event.allDay {
                Text(event.endAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }

    private func eventSourceIcon(_ event: LifeCalendarEvent) -> some View {
        Image(systemName: symbol(for: event.source))
            .foregroundStyle(event.source == "task" ? RememberDesign.accent : RememberDesign.text2)
            .frame(width: 24)
            .accessibilityHidden(true)
    }

    private func eventDetails(_ event: LifeCalendarEvent) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(event.title)
                .font(.subheadline.weight(.semibold))
            let detail = [event.location, event.calendarName].filter { !$0.isEmpty }.joined(separator: " · ")
            if !detail.isEmpty {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
        }
    }

    private func moveWeek(by value: Int) {
        selectedDate = Calendar.current.date(byAdding: .weekOfYear, value: value, to: selectedDate) ?? selectedDate
    }

    private func hasEvents(on day: Date) -> Bool {
        store.lifeSnapshot.events.contains {
            $0.status != "cancelled" && Calendar.current.isDate($0.startAt, inSameDayAs: day)
        }
    }

    private func symbol(for source: String) -> String {
        switch source {
        case "apple": "apple.logo"
        case "google": "g.circle"
        case "outlook": "envelope"
        case "task": "checklist"
        default: "calendar"
        }
    }

    private func sync() {
        Task {
            do {
                await store.syncCalendar(try await calendarService.readApprovedEvents())
            } catch {
                store.errorMessage = error.localizedDescription
                store.errorIsPresented = true
            }
        }
    }
}
