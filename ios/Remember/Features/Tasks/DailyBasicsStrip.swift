import SwiftUI

/// Daily habits as tap-to-check chips.
struct DailyBasicsStrip: View {
    @Environment(AppStore.self) private var store
    /// Set when the strip lives in a List: sheets presented from inside List rows don't appear,
    /// so the host presents the composer instead.
    var onAdd: (() -> Void)?
    @State private var isAdding = false
    @State private var toggleCount = 0

    var body: some View {
        let items = store.lifeSnapshot.floor
        Group {
            if items.isEmpty {
                Button {
                    add()
                } label: {
                    Label("Add a daily habit", systemImage: "plus")
                }
                .buttonStyle(.rememberQuiet)
            } else {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    SectionHeading(title: "Every day", trailing: "\(doneCount(items)) of \(items.count)")
                    ScrollView(.horizontal) {
                        HStack(spacing: RememberDesign.spacingSmall) {
                            ForEach(items) { item in
                                chip(item)
                            }
                            Button {
                                add()
                            } label: {
                                Image(systemName: "plus")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(RememberDesign.text2)
                                    .frame(width: 48, height: 48)
                                    .background(RememberDesign.card, in: .capsule)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Add a daily habit")
                        }
                    }
                    .scrollIndicators(.hidden)
                    .scrollClipDisabled()
                }
            }
        }
        .sensoryFeedback(.selection, trigger: toggleCount)
        .sheet(isPresented: $isAdding) { LifeFloorComposerView() }
    }

    private func add() {
        if let onAdd { onAdd() } else { isAdding = true }
    }

    private func isDone(_ item: LifeFloorItem) -> Bool {
        item.completionDates.contains { Calendar.current.isDateInToday($0) }
    }

    private func doneCount(_ items: [LifeFloorItem]) -> Int {
        items.count { isDone($0) }
    }

    private func chip(_ item: LifeFloorItem) -> some View {
        let done = isDone(item)
        return Button {
            toggleCount += 1
            Task { await store.toggleLifeFloorItem(item.id) }
        } label: {
            HStack(spacing: RememberDesign.spacingSmall) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(done ? RememberDesign.accent : RememberDesign.text3)
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(done ? RememberDesign.text2 : .white)
                    .strikethrough(done, color: RememberDesign.text3)
            }
            .padding(.horizontal, RememberDesign.spacing)
            .frame(minHeight: 48)
            .background(RememberDesign.card, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
        .accessibilityValue(done ? "Done today" : "Not done today")
    }
}
