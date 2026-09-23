import SwiftUI

struct LivingThreadsView: View {
    let imprints: [Imprint]
    let reflections: [EvolutionReflection]

    private var threads: [LivingThread] {
        LivingThreadBuilder.build(from: imprints, reflections: reflections)
    }

    var body: some View {
        if threads.isEmpty {
            RememberEmptyState(
                systemImage: "point.3.connected.trianglepath.dotted",
                title: "No threads yet",
                message: "They form when an idea shows up in a few saves."
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                SectionHeading(title: "Ideas that keep finding you")

                ForEach(threads) { thread in
                    NavigationLink(value: thread) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(thread.name)
                                    .font(.rememberSectionTitle)
                                    .foregroundStyle(RememberDesign.text)
                                Spacer()
                                Text(CountLabelFormatter.text(thread.saves.count, singular: "save"))
                                    .font(.rememberMeta)
                                    .foregroundStyle(RememberDesign.text2)
                            }
                            Label(thread.pulse.label, systemImage: thread.pulse.systemImage)
                                .font(.rememberMeta)
                                .foregroundStyle(RememberDesign.text2)
                            Text(thread.latest.essence)
                                .font(.subheadline)
                                .foregroundStyle(RememberDesign.text)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .rememberCard(padding: RememberDesign.spacing)
                        .contentShape(.rect(cornerRadius: RememberDesign.cornerRadius))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("remember.thread.\(thread.id)")
                    .accessibilityHint("Shows how this idea changed")
                }
            }
        }
    }
}
