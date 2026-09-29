import SwiftUI

/// Life → Sleep: Going to bed, the last 7 nights, and the one tip worth acting on.
struct SleepView: View {
    @Environment(AppStore.self) private var store
    @Environment(SleepGuard.self) private var sleepGuard
    @Binding private var lifeSection: LifeSection

    init(lifeSection: Binding<LifeSection> = .constant(.sleep)) {
        _lifeSection = lifeSection
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $lifeSection,
                    choices: LifeSection.allCases,
                    accessibilityIdentifier: "remember.section.life",
                    title: { $0.rawValue }
                )
                ScrollView {
                    if store.sleep.enabled {
                        content(now: .now)
                    } else {
                        off
                    }
                }
                .refreshable { await refreshFromHealth(force: true) }
            }
            .rememberBottomDock()
            .rememberPrimaryActions()
            .task { await refreshFromHealth(force: false) }
        }
    }

    // MARK: Off

    private var off: some View {
        RememberEmptyState(
            systemImage: "moon.stars.fill",
            title: "Phone-free nights",
            message: "Tap Going to bed when you're done for the night. Your phone stays quiet until you're up.",
            actionTitle: "Turn on",
            action: {
                Task {
                    await store.updateSleep { $0.enabled = true }
                    store.selectedTab = .settings
                }
            }
        )
        .padding(.top, RememberDesign.spacingLarge)
    }

    // MARK: On

    private func content(now: Date) -> some View {
        let nights = SleepInsights.lastWeek(SleepInsights.nights(from: store.lifeSnapshot.health), today: MorningFlow.dayKey(now))
        let week = SleepInsights.week(nights)
        let tip = SleepTip(week)
        return LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            tonightCard(lastNight: nights.first { SleepInsights.daysBetween($0.key, MorningFlow.dayKey(now)) <= 1 })
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Last 7 nights")
                if nights.isEmpty {
                    Text("No nights yet. Tap Going to bed tonight and I'm up tomorrow.")
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .rememberCard(padding: RememberDesign.spacing)
                } else {
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        NightsChart(nights: nights, week: week)
                        statsRow(week)
                    }
                    .rememberCard(padding: RememberDesign.spacing)
                }
            }
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Text(tip.title).font(.rememberRowTitle)
                Text(tip.line)
                    .font(.subheadline)
                    .foregroundStyle(RememberDesign.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing)
            Button("Sleep settings", systemImage: "slider.horizontal.3") { store.selectedTab = .settings }
                .buttonStyle(.rememberSecondary)
                .accessibilityIdentifier("remember.sleep.settings")
            Text("Trouble sleeping most nights for weeks? Bring it up with a doctor.")
                .font(.footnote)
                .foregroundStyle(RememberDesign.text3)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(RememberDesign.spacing)
        .padding(.bottom, RememberDesign.spacingXLarge)
    }

    private func tonightCard(lastNight: SleepNight?) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            HStack(spacing: 6) {
                Image(systemName: "moon.fill").font(.caption)
                Text("TONIGHT")
                    .font(.rememberEyebrow)
                    .tracking(1.2)
            }
            .foregroundStyle(RememberDesign.accent)
            .accessibilityElement(children: .combine)
            Text("Done for the night?")
                .font(.rememberHero)
                .fixedSize(horizontal: false, vertical: true)
            Text("Tap when you start winding down. Your phone stays quiet until you're up.")
                .font(.body)
                .foregroundStyle(RememberDesign.text2)
                .fixedSize(horizontal: false, vertical: true)
            if let lastNight {
                Text("Last night \(lastNight.fellAsleep.formatted(date: .omitted, time: .shortened)) – \(lastNight.gotUp.formatted(date: .omitted, time: .shortened)) · \(lastNight.hours.sleepDurationLabel)")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.text3)
            }
            GoingToBedButton(style: .primary)
                .padding(.top, RememberDesign.spacingXXSmall)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .rememberCard()
    }

    private func statsRow(_ week: SleepWeekNumbers) -> some View {
        HStack(alignment: .top, spacing: RememberDesign.spacingSmall) {
            stat(week.averageHours.map { "\(String(format: "%.1f", $0)) hr" } ?? "—", label: "average")
            stat(week.nights >= SleepMath.minNights ? week.usualBedtime.map { SleepMath.label(afterEvening: $0) } ?? "—" : "—", label: "usual bedtime")
            stat(week.wakeRangeMinutes.map { SleepMath.durationLabel(minutes: $0) } ?? "—", label: "wake-up range")
        }
    }

    private func stat(_ value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption)
                .foregroundStyle(RememberDesign.text3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// Keeps last nights current from Apple Health, without prompting, at most every 10 minutes.
    private func refreshFromHealth(force: Bool) async {
        guard force || (store.lastHealthSync ?? .distantPast) < .now.addingTimeInterval(-600) else { return }
        await store.syncSleepQuietly(await HealthSyncService().readSleepQuietly())
    }
}

/// "Going to bed": phone-free starts now, with Undo for a stray tap.
struct GoingToBedButton: View {
    enum Style { case primary, secondary }

    @Environment(AppStore.self) private var store
    @Environment(SleepGuard.self) private var sleepGuard
    let style: Style
    @State private var feedback = 0

    var body: some View {
        Group {
            if style == .primary {
                button.buttonStyle(.rememberPrimary)
            } else {
                button.buttonStyle(.rememberSecondary)
            }
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: feedback)
    }

    private var button: some View {
        Button {
            feedback += 1
            let previous = sleepGuard.goToBed()
            store.showToast("Phone-free until you're up") { [sleepGuard] in
                sleepGuard.restore(previous)
            }
        } label: {
            Label("Going to bed", systemImage: "moon.fill")
        }
        .accessibilityHint("Your phone stays quiet until you tap I'm up")
        .accessibilityIdentifier("remember.sleep.goingToBed")
    }
}

/// One bar per night, from falling asleep to getting up, with the usual bedtime and wake-up as guides.
private struct NightsChart: View {
    let nights: [SleepNight]
    let week: SleepWeekNumbers

    private let labelWidth: CGFloat = 36
    private let rowHeight: CGFloat = 28
    private let axisHeight: CGFloat = 20

    private struct Row: Identifiable {
        let id: String
        let label: String
        let start: Int
        let end: Int
        let spoken: String
    }

    private var rows: [Row] {
        nights.sorted { $0.key < $1.key }.map { night in
            // Minutes after 6 PM, so a night reads left to right across midnight.
            let start = SleepMath.afterEvening(night.fellAsleep)
            let length = Int(night.gotUp.timeIntervalSince(night.fellAsleep) / 60)
            let weekday = weekdayLabel(night.key)
            let times = "\(night.fellAsleep.formatted(date: .omitted, time: .shortened)) to \(night.gotUp.formatted(date: .omitted, time: .shortened))"
            return Row(id: night.key, label: weekday, start: start, end: start + max(length, 1),
                       spoken: "\(weekday), \(times), \(night.hours.sleepDurationLabel)\(night.rating.map { ", \($0.label.lowercased())" } ?? "")")
        }
    }

    var body: some View {
        let rows = rows
        // The usual bedtime and wake-up mean something once there are 3 nights.
        let guides = week.nights >= SleepMath.minNights ? [week.usualBedtime, week.usualWake].compactMap { $0 } : []
        let lower = ((min(rows.map(\.start).min() ?? 0, guides.min() ?? Int.max) - 30) / 60) * 60
        let upper = ((max(rows.map(\.end).max() ?? 0, guides.max() ?? 0) + 89) / 60) * 60
        let ticks = Array(stride(from: ((lower + 179) / 180) * 180, through: upper, by: 180)).filter { $0 > lower + 20 && $0 < upper - 20 }
        let plotHeight = CGFloat(rows.count) * rowHeight
        HStack(alignment: .top, spacing: RememberDesign.spacingSmall) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(rows) { row in
                    Text(row.label)
                        .font(.caption)
                        .foregroundStyle(RememberDesign.text2)
                        .frame(height: rowHeight)
                }
            }
            .frame(width: labelWidth, alignment: .leading)
            GeometryReader { proxy in
                let scale = proxy.size.width / CGFloat(max(1, upper - lower))
                let x = { (minutes: Int) in CGFloat(minutes - lower) * scale }
                ZStack(alignment: .topLeading) {
                    ForEach(guides, id: \.self) { line in
                        Path { path in
                            path.move(to: CGPoint(x: x(line), y: 0))
                            path.addLine(to: CGPoint(x: x(line), y: plotHeight))
                        }
                        .stroke(RememberDesign.text3.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    }
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        Capsule()
                            .fill(RememberDesign.accent)
                            .frame(width: max(6, x(row.end) - x(row.start)), height: 12)
                            .offset(x: x(row.start), y: CGFloat(index) * rowHeight + (rowHeight - 12) / 2)
                    }
                    ForEach(ticks, id: \.self) { tick in
                        Text(SleepMath.label(afterEvening: tick).replacingOccurrences(of: ":00", with: ""))
                            .font(.caption2)
                            .foregroundStyle(RememberDesign.text3)
                            .fixedSize()
                            .position(x: x(tick), y: plotHeight + axisHeight / 2 + 2)
                    }
                }
            }
            .frame(height: plotHeight + axisHeight)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Last 7 nights")
        .accessibilityValue(rows.map(\.spoken).joined(separator: ". "))
    }

    private func weekdayLabel(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let date = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) else { return key }
        return date.formatted(.dateTime.weekday(.abbreviated))
    }
}
