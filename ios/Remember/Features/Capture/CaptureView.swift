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
            ZStack {
                WarmBackground()
                if didSave {
                    successView
                } else {
                    composer
                }
            }
            .navigationTitle("Save something")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: dismiss.callAsFunction)
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
    }

    private var composer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    Text("What do you want to keep?")
                        .font(.title2.bold())
                    Text("Save something you found, or a thought you don’t want to lose.")
                        .foregroundStyle(RememberDesign.secondaryText)
                }

                Picker("What are you saving?", selection: $captureKind) {
                    ForEach(CaptureKind.allCases) { kind in
                        Label(kind.rawValue, systemImage: kind.systemImage)
                            .tag(kind)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("remember.capture.kind")

                inputSurface

                DisclosureGroup(isExpanded: $optionsAreExpanded) {
                    VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                        if captureKind == .link {
                            TextField("Why did this matter? (optional)", text: $personalReaction, axis: .vertical)
                                .lineLimit(2...5)
                                .accessibilityLabel("Why this mattered")
                        }
                        ReturnCuePicker(
                            selection: returnCue,
                            returnDate: returnDate,
                            onSelect: { returnCue = $0 },
                            onDateChange: { returnDate = $0 }
                        )
                    }
                    .padding(.top, RememberDesign.spacing)
                } label: {
                    Label("Add context or a reminder", systemImage: "slider.horizontal.3")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                }
                .rememberSurface()

                if let validationMessage {
                    Label(validationMessage, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.danger)
                        .accessibilityFocused($validationMessageIsFocused)
                        .rememberSurface()
                }
            }
            .padding(RememberDesign.spacing)
            .padding(.bottom, 92)
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: save) {
                Group {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text(captureKind == .thought ? "Save thought" : "Save link")
                            .bold()
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(RememberDesign.accent)
            .foregroundStyle(RememberDesign.accentInk)
            .disabled(isSaving || !canSave)
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.vertical, RememberDesign.spacingSmall)
            .background(.ultraThinMaterial)
        }
    }

    @ViewBuilder
    private var inputSurface: some View {
        switch captureKind {
        case .link:
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Label("Paste a link", systemImage: "link")
                    .font(.headline)
                TextField("https://…", text: $linkInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .focused($focusedField, equals: .link)
                    .accessibilityLabel("Link to save")
                    .submitLabel(.go)
                    .onSubmit(save)
                Text("YouTube, TikTok, X, and public web links are supported.")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .rememberSurface()
        case .thought:
            VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                Label("Your thought", systemImage: "quote.bubble")
                    .font(.headline)
                TextField(
                    "A realization, question, decision, or idea…",
                    text: $thoughtInput,
                    axis: .vertical
                )
                .lineLimit(5...12)
                .focused($focusedField, equals: .thought)
                .accessibilityLabel("Thought to remember")
                Text("It will join your Library, shape Ask and Patterns, and return when it can help.")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            .rememberSurface()
        }
    }

    private var successView: some View {
        ContentUnavailableView {
            Label(wasAlreadySaved ? "Already saved" : "Saved", systemImage: "checkmark.circle.fill")
        } description: {
            Text(successMessage)
        } actions: {
            Button("Done", action: dismiss.callAsFunction)
                .buttonStyle(.borderedProminent)
                .tint(RememberDesign.accent)
                .foregroundStyle(RememberDesign.accentInk)
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
            presentValidation("Write the thought you want to remember.")
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
        if wasAlreadySaved { return "This link is already in your Library." }
        if captureKind == .thought {
            if let returnCue { return "Your thought is part of Remember now, and will come back \(returnCue.label.lowercased())." }
            return "Your thought can now shape answers, patterns, and useful returns."
        }
        if let returnCue { return "Remember will bring it back \(returnCue.label.lowercased())." }
        return "Analysis will continue in the background."
    }
}
