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
            Divider()
                .padding(.bottom, RememberDesign.spacingSmall)

            if let reflection {
                HStack(alignment: .top, spacing: RememberDesign.spacingSmall) {
                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                        .foregroundStyle(RememberDesign.accent)
                        .frame(width: 30, height: 30)
                        .background(RememberDesign.accent.opacity(0.12), in: .circle)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(reflection.insightTitle)
                            .font(.subheadline.bold())
                        Text(reflection.insightBody)
                            .font(.caption)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                }
                Button("See how I’m changing", systemImage: "arrow.right") {
                    store.selectedTab = .evolution
                }
                .font(.subheadline.bold())
                .foregroundStyle(RememberDesign.accent)
                .padding(.leading, 38)
                .accessibilityIdentifier("remember.memory-check-in.compass")
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Where does this land now?")
                        .font(.subheadline.bold())
                    Text("Your answer teaches Remember what belongs in your life today.")
                        .font(.caption)
                        .foregroundStyle(RememberDesign.secondaryText)
                }

                LazyVGrid(columns: columns, spacing: RememberDesign.spacingSmall) {
                    ForEach(MemoryReflection.allCases) { choice in
                        Button {
                            choose(choice)
                        } label: {
                            Label(choice.label, systemImage: choice.systemImage)
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.roundedRectangle(radius: RememberDesign.controlRadius))
                        .disabled(isSaving)
                        .accessibilityIdentifier("remember.memory-check-in.\(choice.rawValue)")
                    }
                }

                if saveFailed {
                    Label("That answer was not saved. Please try again.", systemImage: "exclamationmark.circle")
                        .font(.caption)
                        .foregroundStyle(.red)
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
