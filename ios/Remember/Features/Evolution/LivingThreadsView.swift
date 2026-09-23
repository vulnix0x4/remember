import SwiftUI

struct LivingThreadsView: View {
    let imprints: [Imprint]
    let reflections: [EvolutionReflection]

    private var threads: [LivingThread] {
        LivingThreadBuilder.build(from: imprints, reflections: reflections)
    }

    var body: some View {
        if threads.isEmpty {
            ContentUnavailableView(
                "Living threads will form here",
                systemImage: "point.3.connected.trianglepath.dotted",
                description: Text("When an idea returns across more than one analyzed save, Remember will show how the thought is changing.")
            )
        } else {
            VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                Text("Ideas that keep finding you")
                    .font(.title2)
                    .bold()
                Text("A thread is the path between related saves. Open one to see where the idea began, where it is now, and what remains worth asking.")
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)

                ForEach(threads) { thread in
                    NavigationLink(value: thread) {
                        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(thread.name)
                                    .font(.title3)
                                    .bold()
                                Spacer()
                                Text(CountLabelFormatter.text(thread.saves.count, singular: "save"))
                                    .font(.subheadline)
                                    .foregroundStyle(RememberDesign.secondaryText)
                            }
                            Label(thread.pulse.label, systemImage: thread.pulse.systemImage)
                                .font(.subheadline)
                                .foregroundStyle(thread.pulse.kind == .held || thread.pulse.kind == .shifting ? RememberDesign.accent : RememberDesign.secondaryText)
                            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                                Text(thread.earliest.essence)
                                    .lineLimit(2)
                                Image(systemName: "arrow.down")
                                    .foregroundStyle(RememberDesign.accent)
                                    .accessibilityHidden(true)
                                Text(thread.latest.essence)
                                    .bold()
                                    .lineLimit(2)
                            }
                            .font(.subheadline)
                            Label("Open thread", systemImage: "arrow.right")
                                .font(.subheadline)
                                .bold()
                                .foregroundStyle(RememberDesign.accent)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .rememberSurface()
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("remember.thread.\(thread.id)")
                    .accessibilityHint("Shows how this idea changed across your saves")
                }
            }
        }
    }
}
