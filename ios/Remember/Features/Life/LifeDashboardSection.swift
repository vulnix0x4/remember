import SwiftUI

struct LifeDashboardSection: View {
    @Environment(AppStore.self) private var store

    private var todayEventCount: Int {
        store.lifeSnapshot.events.count { Calendar.current.isDateInToday($0.startAt) && $0.status != "cancelled" }
    }

    private var todaySteps: Int {
        Int(store.lifeSnapshot.health.filter { $0.type == "steps" && Calendar.current.isDateInToday($0.startAt) }.reduce(0) { $0 + $1.value })
    }

    private var floorProgress: String? {
        guard !store.lifeSnapshot.floor.isEmpty else { return nil }
        let complete = store.lifeSnapshot.floor.count { item in item.completionDates.contains { Calendar.current.isDateInToday($0) } }
        return "\(complete)/\(store.lifeSnapshot.floor.count) Life Floor"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Label("YOUR OPERATING SYSTEM", systemImage: "bolt.fill")
                        .font(.caption2.bold())
                        .foregroundStyle(RememberDesign.accent)
                    Text("What matters now")
                        .font(.title2.bold())
                }
                Spacer()
                if store.isLoadingLife { ProgressView().controlSize(.small) }
            }

            if let task = store.lifeSnapshot.activeTask {
                Button { store.selectedTab = .tasks } label: {
                    VStack(alignment: .leading, spacing: 15) {
                        HStack {
                            Label("NOW", systemImage: "location.fill")
                                .font(.caption2.bold())
                                .foregroundStyle(RememberDesign.accent)
                            Spacer()
                            Text("\(task.durationMinutes) min")
                                .font(.caption)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }
                        Text(task.title)
                            .font(.title.bold())
                            .multilineTextAlignment(.leading)
                        Text(task.firstStep.isEmpty ? "Define the first physical action." : task.firstStep)
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.secondaryText)
                            .multilineTextAlignment(.leading)
                        if let floorProgress {
                            Label(floorProgress, systemImage: "checkmark.circle")
                                .font(.caption.bold())
                                .foregroundStyle(RememberDesign.accent)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(22)
                    .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                    .overlay { RoundedRectangle(cornerRadius: RememberDesign.cornerRadius).stroke(RememberDesign.accent.opacity(0.25)) }
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens Tasks")
            } else {
                Button { store.selectedTab = .tasks } label: {
                    ContentUnavailableView("Choose your next move", systemImage: "checklist", description: Text("Tasks will keep exactly one action in focus."))
                        .frame(maxWidth: .infinity, minHeight: 170)
                        .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: RememberDesign.cornerRadius))
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 12) {
                dashboardButton(title: "Calendar", value: todayEventCount == 0 ? "Open day" : "\(todayEventCount) today", symbol: "calendar", tab: .calendar)
                dashboardButton(title: "Health", value: store.lifeSnapshot.health.isEmpty ? "Connect" : "\(todaySteps.formatted()) steps", symbol: "heart.text.square", tab: .health)
            }
        }
    }

    private func dashboardButton(title: String, value: String, symbol: String, tab: AppTab) -> some View {
        Button { store.selectedTab = tab } label: {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: symbol).foregroundStyle(RememberDesign.accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.caption).foregroundStyle(RememberDesign.secondaryText)
                    Text(value)
                        .font(.subheadline.bold())
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}
