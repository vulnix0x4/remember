import SwiftUI

enum RememberDesign {
    static let spacingXXSmall = 4.0
    static let spacingSmall = 8.0
    static let spacingCompact = 12.0
    static let spacing = 16.0
    static let spacingLarge = 24.0
    static let spacingXLarge = 32.0

    static let controlRadius = 12.0
    static let cornerRadius = 16.0
    static let sheetRadius = 24.0

    static let canvas = Color(red: 0.047, green: 0.055, blue: 0.071)
    static let surface = Color(red: 0.125, green: 0.14, blue: 0.18)
    static let surfaceRaised = Color(red: 0.18, green: 0.20, blue: 0.26)
    static let mutedFill = surfaceRaised
    static let line = Color(red: 0.30, green: 0.32, blue: 0.40)
    static let secondaryText = Color(uiColor: .secondaryLabel)
    static let tertiaryText = Color(uiColor: .tertiaryLabel)
    static let danger = Color(uiColor: .systemRed)

    static let accent = Color.accentColor
    static let accentInk = Color("AccentInk")
    static let focusSurface = Color(red: 0.105, green: 0.12, blue: 0.17)
    static let focusSecondaryText = Color.white.opacity(0.82)
}

extension View {
    func rememberSurface(padding: CGFloat = RememberDesign.spacing) -> some View {
        self
            .padding(padding)
            .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.cornerRadius))
    }
}

struct QuickAddBar: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(RememberDesign.accent)
                    .frame(width: 26)
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(RememberDesign.surfaceRaised, in: .rect(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(RememberDesign.line.opacity(0.55), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.top, RememberDesign.spacingSmall)
        .padding(.bottom, RememberDesign.spacingSmall)
        .background(RememberDesign.canvas)
    }
}

struct TaskQuickAddBar: View {
    @Environment(AppStore.self) private var store
    let onShowDetails: () -> Void
    @State private var title = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var savedCount = 0
    @FocusState private var titleIsFocused: Bool

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
                    .padding(.horizontal, RememberDesign.spacingSmall)
            }
            HStack(spacing: RememberDesign.spacingSmall) {
                Image(systemName: "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(RememberDesign.accentInk)
                    .accessibilityHidden(true)
                TextField(
                    "",
                    text: $title,
                    prompt: Text("Add a task…").foregroundColor(Color.black.opacity(0.55)),
                    axis: .vertical
                )
                    .lineLimit(1...2)
                    .foregroundStyle(.black)
                    .tint(RememberDesign.accent)
                    .focused($titleIsFocused)
                    .submitLabel(.done)
                    .onSubmit(save)
                    .onChange(of: title) { _, value in
                        if value.count > 300 { title = String(value.prefix(300)) }
                        if errorMessage != nil { errorMessage = nil }
                    }
                    .accessibilityLabel("Quick add task")
                    .disabled(isSaving)
                Button {
                    if canSave { save() }
                    else { onShowDetails() }
                } label: {
                    Group {
                        if isSaving {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: canSave ? "arrow.up" : "slider.horizontal.3")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .frame(width: 44, height: 44)
                    .foregroundStyle(canSave ? RememberDesign.accentInk : Color.black.opacity(0.7))
                    .background(canSave ? RememberDesign.accent : Color.black.opacity(0.08), in: .circle)
                }
                .buttonStyle(.plain)
                .disabled(isSaving)
                .accessibilityLabel(canSave ? "Add task" : "Add task with details")
                .accessibilityIdentifier("remember.task.quickAction")
            }
            .padding(.leading, RememberDesign.spacing)
            .padding(.trailing, 6)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(.white, in: .rect(cornerRadius: 16))
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.top, RememberDesign.spacingSmall)
        .padding(.bottom, RememberDesign.spacingSmall)
        .background(RememberDesign.canvas)
        .sensoryFeedback(.success, trigger: savedCount)
    }

    private func save() {
        guard canSave, !isSaving else { return }
        let submittedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        isSaving = true
        errorMessage = nil
        Task {
            let succeeded = await store.createLifeTask(
                title: submittedTitle,
                firstStep: "",
                area: .direction,
                duration: 15
            )
            isSaving = false
            if succeeded {
                title = ""
                titleIsFocused = false
                savedCount += 1
            } else {
                errorMessage = "Couldn’t add this task. Your words are still here; try again."
            }
        }
    }
}
