import SwiftUI

struct CaptureView: View {
    private enum CaptureKind: String, CaseIterable, Identifiable {
        case link = "Link"
        case thought = "Thought"

        var id: Self { self }
        var systemImage: String { self == .link ? "link" : "quote.bubble" }
    }

    private enum Field: Hashable {
        case link
        case thought
    }

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var captureKind: CaptureKind = .link
    @State private var linkInput = ""
    @State private var thoughtInput = ""
    @State private var personalReaction = ""
    @State private var returnCue: ReturnCue?
    @State private var returnDate = ReturnSchedule.tomorrow()
    @State private var validationMessage: String?
    @State private var isSaving = false
    @State private var didSave = false
    @State private var wasAlreadySaved = false
    @State private var optionsAreExpanded = false
    @FocusState private var focusedField: Field?
    @AccessibilityFocusState private var validationMessageIsFocused: Bool

    var body: some View {
        NavigationStack {
            Group {
                if didSave {
                    successView
                } else {
                    composer
                }
            }
            .background(RememberDesign.canvas)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(didSave ? "Close" : "Cancel", action: dismiss.callAsFunction)
                }
            }
            .task { focusCurrentField() }
            .onChange(of: captureKind) {
                validationMessage = nil
                validationMessageIsFocused = false
                focusCurrentField()
            }
            .sensoryFeedback(.success, trigger: didSave)
            .interactiveDismissDisabled(isSaving)
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private var composer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                Text("Save something")
                    .font(.rememberScreenTitle)
                    .accessibilityAddTraits(.isHeader)

                kindPicker

                inputSurface

                if optionsAreExpanded {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        if captureKind == .link {
                            SectionHeading(title: "Why it matters")
                            TextField("Optional", text: $personalReaction, axis: .vertical)
                                .lineLimit(2...5)
                                .padding(RememberDesign.spacing)
                                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.controlRadius))
                                .accessibilityLabel("Why this mattered")
                                .padding(.bottom, RememberDesign.spacingSmall)
                        }
                        SectionHeading(title: "Bring it back when…")
                        ReturnCuePicker(
                            selection: returnCue,
                            returnDate: returnDate,
                            onSelect: { returnCue = $0 },
                            onDateChange: { returnDate = $0 }
                        )
                    }
                } else {
                    Button("Add a note or reminder", systemImage: "plus") {
                        withAnimation(.snappy(duration: 0.2)) { optionsAreExpanded = true }
                    }
                    .buttonStyle(.rememberQuiet)
                    .accessibilityIdentifier("remember.capture.options")
                }

                if let validationMessage {
                    Label(validationMessage, systemImage: "exclamationmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(RememberDesign.danger)
                        .accessibilityFocused($validationMessageIsFocused)
                }
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.bottom, RememberDesign.spacingLarge)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button(action: save) {
                if isSaving {
                    ProgressView().tint(RememberDesign.canvas)
                } else {
                    Text(captureKind == .thought ? "Save thought" : "Save link")
                }
            }
            .buttonStyle(.rememberPrimary)
            .disabled(isSaving || !canSave)
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.vertical, RememberDesign.spacingSmall)
            .background(RememberDesign.canvas)
        }
    }

    private var kindPicker: some View {
        HStack(spacing: 4) {
            ForEach(CaptureKind.allCases) { kind in
                let isSelected = captureKind == kind
                Button {
                    withAnimation(.snappy(duration: 0.2)) { captureKind = kind }
                } label: {
                    Label(kind.rawValue, systemImage: kind.systemImage)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isSelected ? RememberDesign.canvas : RememberDesign.text2)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(isSelected ? RememberDesign.primaryFill : Color.clear, in: .capsule)
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(kind.rawValue)
                .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(4)
        .background(RememberDesign.card, in: .capsule)
        .accessibilityIdentifier("remember.capture.kind")
        .sensoryFeedback(.selection, trigger: captureKind)
    }

    @ViewBuilder
    private var inputSurface: some View {
        switch captureKind {
        case .link:
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                TextField("Paste a link", text: $linkInput)
                    .font(.title3.weight(.semibold))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .focused($focusedField, equals: .link)
                    .accessibilityLabel("Link to save")
                    .submitLabel(.go)
                    .onSubmit(save)
                    .padding(RememberDesign.spacing + 4)
                    .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
                Text("YouTube, TikTok, X, or any web page.")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text3)
                    .padding(.horizontal, RememberDesign.spacingXXSmall)
            }
        case .thought:
            TextField("What’s on your mind?", text: $thoughtInput, axis: .vertical)
                .font(.title3.weight(.semibold))
                .lineLimit(5...12)
                .focused($focusedField, equals: .thought)
                .accessibilityLabel("Thought to remember")
                .padding(RememberDesign.spacing + 4)
                .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        }
    }

    private var successView: some View {
        VStack {
            Spacer()
            RememberEmptyState(
                systemImage: "checkmark",
                title: wasAlreadySaved ? "Already saved" : "Saved",
                message: successMessage
            )
            Spacer()
            Button("Done", action: dismiss.callAsFunction)
                .buttonStyle(.rememberPrimary)
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.bottom, RememberDesign.spacingSmall)
        }
    }

    private var canSave: Bool {
        switch captureKind {
        case .link: !linkInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .thought: !normalizedThought.isEmpty
        }
    }

    private func focusCurrentField() {
        focusedField = captureKind == .link ? .link : .thought
    }

    private func save() {
        validationMessage = nil
        validationMessageIsFocused = false

        switch captureKind {
        case .link:
            saveLink()
        case .thought:
            saveThought()
        }
    }

    private func saveLink() {
        guard let url = URLValidator.validatedWebURL(from: linkInput) else {
            presentValidation("Enter a complete https link.")
            return
        }
        wasAlreadySaved = store.imprints.contains(where: { $0.url == url })
        isSaving = true
        Task {
            do {
                try await store.capture(
                    url,
                    personalReaction: normalizedReaction,
                    returnCue: returnCue,
                    returnAt: returnCue == .date ? try ReturnSchedule.instant(for: returnDate) : nil
                )
                didSave = true
            } catch {
                presentValidation("This link was not saved. \(error.localizedDescription)")
            }
            isSaving = false
        }
    }

    private func saveThought() {
        guard !normalizedThought.isEmpty else {
            presentValidation("Write something first.")
            return
        }
        wasAlreadySaved = false
        isSaving = true
        Task {
            do {
                try await store.captureThought(
                    normalizedThought,
                    returnCue: returnCue,
                    returnAt: returnCue == .date ? try ReturnSchedule.instant(for: returnDate) : nil
                )
                didSave = true
            } catch {
                presentValidation("This thought was not saved. \(error.localizedDescription)")
            }
            isSaving = false
        }
    }

    private func presentValidation(_ message: String) {
        validationMessage = message
        validationMessageIsFocused = true
    }

    private var normalizedThought: String {
        thoughtInput.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedReaction: String? {
        let value = personalReaction.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private var successMessage: String {
        if wasAlreadySaved { return "It’s already in your Library." }
        if let returnCue { return "It’ll come back \(returnCue.label.lowercased())." }
        return captureKind == .thought ? "It’s in your Library now." : "Reading it in the background."
    }
}
