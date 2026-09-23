import SwiftUI

struct LivingThreadDetailView: View {
    let thread: LivingThread
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                    Text(thread.name)
                        .font(.rememberScreenTitle)
                        .accessibilityAddTraits(.isHeader)
                    Text("From \(CountLabelFormatter.text(thread.saves.count, singular: "save"))")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text2)
                }

                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    Text("The question now")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.text2)
                    Text(thread.question)
                        .font(.rememberSectionTitle)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Explore in Ask", systemImage: "bubble.left.and.text.bubble.right", action: exploreInAsk)
                        .buttonStyle(.rememberPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing + 4)

                HStack(alignment: .top, spacing: RememberDesign.spacingCompact) {
                    Image(systemName: thread.pulse.systemImage)
                        .font(.title3)
                        .foregroundStyle(RememberDesign.text2)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                        Text(thread.pulse.label)
                            .font(.rememberRowTitle)
                        Text(thread.pulse.detail)
                            .font(.subheadline)
                            .foregroundStyle(RememberDesign.text2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)

                VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                    changePoint("Where it started", date: thread.earliest.savedAt, text: thread.earliest.essence)
                    Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
                    changePoint("Where it is now", date: thread.latest.savedAt, text: thread.latest.essence)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .rememberCard(padding: RememberDesign.spacing)

                if !thread.turningPoints.isEmpty {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        SectionHeading(title: "Your turning points")
                        ForEach(thread.turningPoints.suffix(4)) { point in
                            NavigationLink(value: point.imprint) {
                                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                                    Label(point.label, systemImage: point.response.systemImage)
                                        .font(.rememberMeta)
                                        .foregroundStyle(RememberDesign.text2)
                                    Text(point.imprint.essence)
                                        .font(.rememberRowTitle)
                                        .foregroundStyle(.white)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(point.detail)
                                        .font(.subheadline)
                                        .foregroundStyle(RememberDesign.text2)
                                        .multilineTextAlignment(.leading)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .rememberCard(padding: RememberDesign.spacing)
                                .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    SectionHeading(title: "Saves in this thread")
                    ForEach(thread.saves) { imprint in
                        NavigationLink(value: imprint) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(imprint.title)
                                    .font(.rememberRowTitle)
                                    .foregroundStyle(.white)
                                Text(imprint.essence)
                                    .font(.subheadline)
                                    .foregroundStyle(RememberDesign.text2)
                                    .lineLimit(2)
                            }
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, minHeight: RememberDesign.rowHeight - 32, alignment: .leading)
                            .rememberCard(padding: RememberDesign.spacing)
                            .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingXLarge)
        }
        .background(RememberDesign.canvas)
        .rememberBottomDock()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(RememberDesign.canvas, for: .navigationBar)
    }

    private func changePoint(_ title: String, date: Date, text: String) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
            HStack {
                Text(title)
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text2)
                Spacer()
                Text(date, format: .dateTime.month(.abbreviated).year())
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text3)
            }
            Text(text)
                .font(.body.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func exploreInAsk() {
        store.askDraft = thread.question
        store.selectedTab = .ask
    }
}
