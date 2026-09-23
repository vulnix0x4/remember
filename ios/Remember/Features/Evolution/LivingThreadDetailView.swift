import SwiftUI

struct LivingThreadDetailView: View {
    let thread: LivingThread
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("Living thread")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(RememberDesign.accent)
                    Text(thread.name)
                        .font(.largeTitle)
                        .bold()
                    Text("Built from \(CountLabelFormatter.text(thread.saves.count, singular: "save")) you chose to keep.")
                        .foregroundStyle(RememberDesign.secondaryText)
                }

                HStack(alignment: .top, spacing: RememberDesign.spacingSmall) {
                    Image(systemName: thread.pulse.systemImage)
                        .font(.title3)
                        .foregroundStyle(thread.pulse.kind == .released ? RememberDesign.secondaryText : RememberDesign.accent)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text(thread.pulse.label)
                            .font(.headline)
                        Text(thread.pulse.detail)
                            .font(.body)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberSurface()

                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    LabeledContent("Where it started") {
                        Text(thread.earliest.savedAt, format: .dateTime.month(.abbreviated).year())
                    }
                    Text(thread.earliest.essence)
                        .font(.title3)
                    Divider()
                    LabeledContent("Where it is now") {
                        Text(thread.latest.savedAt, format: .dateTime.month(.abbreviated).year())
                    }
                    Text(thread.latest.essence)
                        .font(.title3)
                        .bold()
                }
                .rememberSurface()

                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("The saves in this thread")
                        .font(.headline)
                    ForEach(thread.saves) { imprint in
                        NavigationLink(value: imprint) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(imprint.title)
                                    .font(.body)
                                    .bold()
                                Text(imprint.essence)
                                    .font(.subheadline)
                                    .foregroundStyle(RememberDesign.secondaryText)
                                    .lineLimit(2)
                            }
                            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if !thread.turningPoints.isEmpty {
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                            Text("Your turning points")
                                .font(.headline)
                                .foregroundStyle(RememberDesign.accent)
                            Text("What you decided when an idea came back.")
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.secondaryText)
                        }

                        ForEach(thread.turningPoints.suffix(4)) { point in
                            NavigationLink(value: point.imprint) {
                                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                                    Label(point.label, systemImage: point.response.systemImage)
                                        .font(.subheadline)
                                        .bold()
                                        .foregroundStyle(RememberDesign.accent)
                                    Text(point.imprint.essence)
                                        .font(.body)
                                        .bold()
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(point.detail)
                                        .font(.subheadline)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                }
                                .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            Divider()
                        }
                    }
                    .rememberSurface()
                }

                VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                    Text("The question now")
                        .font(.headline)
                    Text(thread.question)
                        .foregroundStyle(RememberDesign.secondaryText)
                    Button("Explore in Ask", systemImage: "bubble.left.and.text.bubble.right", action: exploreInAsk)
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .foregroundStyle(RememberDesign.accentInk)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .rememberSurface()
            }
            .padding(RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingXLarge)
        }
        .background(WarmBackground())
        .navigationTitle(thread.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func exploreInAsk() {
        store.askDraft = thread.question
        store.selectedTab = .ask
    }
}
