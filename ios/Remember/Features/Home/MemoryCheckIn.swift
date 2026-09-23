import SwiftUI

struct MemoryCheckIn: View {
    let imprint: Imprint
    var onSaved: () -> Void = {}
    @Environment(AppStore.self) private var store
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var reflection: MemoryReflection?
    @State private var isSaving = false
    @State private var saveFailed = false

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Rectangle()
                .fill(RememberDesign.line)
                .frame(height: 1)
                .padding(.vertical, RememberDesign.spacingXXSmall)
                .accessibilityHidden(true)

            if let reflection {
                HStack(alignment: .top, spacing: RememberDesign.spacingSmall) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(RememberDesign.accent)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(reflection.insightTitle)
                            .font(.subheadline.weight(.semibold))
                        Text(reflection.insightBody)
                            .font(.rememberMeta)
                            .foregroundStyle(RememberDesign.text2)
                    }
                }
                Button("See how I’m changing", systemImage: "arrow.right") {
                    store.selectedTab = .evolution
                }
                .buttonStyle(.rememberQuiet)
                .accessibilityIdentifier("remember.memory-check-in.compass")
            } else {
                Text("Where does this land now?")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text2)

                LazyVGrid(columns: columns, spacing: RememberDesign.spacingSmall) {
                    ForEach(MemoryReflection.allCases) { choice in
                        Button {
                            choose(choice)
                        } label: {
                            Text(choice.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .padding(.horizontal, RememberDesign.spacingSmall)
                                .background(RememberDesign.cardRaised, in: .capsule)
                                .contentShape(.capsule)
                        }
                        .buttonStyle(.plain)
                        .disabled(isSaving)
                        .accessibilityIdentifier("remember.memory-check-in.\(choice.rawValue)")
                    }
                }

                if saveFailed {
                    Label("That didn’t save. Try again.", systemImage: "exclamationmark.circle")
                        .font(.rememberMeta)
                        .foregroundStyle(RememberDesign.danger)
                }
            }
        }
    }

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible())]
            : [GridItem(.flexible()), GridItem(.flexible())]
    }

    private func choose(_ choice: MemoryReflection) {
        guard !isSaving else { return }
        isSaving = true
        saveFailed = false
        Task {
            let saved = await store.reflectOnMemory(imprint, response: choice)
            isSaving = false
            if saved {
                reflection = choice
                onSaved()
            }
            else { saveFailed = true }
        }
    }
}
