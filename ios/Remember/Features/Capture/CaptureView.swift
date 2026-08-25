import SwiftUI

struct CaptureView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var validationMessage: String?
    @State private var isSaving = false
    @State private var didSave = false
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Image(systemName: "bookmark.fill")
                            .font(.title)
                            .foregroundStyle(RememberDesign.accentInk)
                            .frame(width: 58, height: 58)
                            .background(RememberDesign.accent, in: .rect(cornerRadius: 18))
                            .accessibilityHidden(true)
                        Text(didSave ? "Saved to your memory" : "Save something that stayed with you")
                            .font(.title)
                            .bold()
                        Text(didSave ? "Analysis continues in the background." : "Paste a YouTube, TikTok, X, or web link. Nothing else is required.")
                            .font(.body)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                    if !didSave {
                        TextField("https://youtube.com/watch…", text: $input)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .focused($inputFocused)
                            .padding(RememberDesign.spacing)
                            .background(RememberDesign.surface, in: .rect(cornerRadius: 15))
                            .overlay { RoundedRectangle(cornerRadius: 15).stroke(RememberDesign.line) }
                            .accessibilityLabel("Link to save")
                            .onSubmit(save)
                        if let validationMessage {
                            Label(validationMessage, systemImage: "exclamationmark.circle")
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        Button(action: save) {
                            if isSaving { ProgressView().frame(maxWidth: .infinity) }
                            else { Label("Save now", systemImage: "arrow.down.to.line").frame(maxWidth: .infinity) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .foregroundStyle(RememberDesign.accentInk)
                        .controlSize(.large)
                        .disabled(isSaving || input.isEmpty)
                    } else {
                        Label("Your link is safe", systemImage: "checkmark.circle.fill")
                            .font(.headline)
                            .foregroundStyle(.green)
                        Button("Done", action: dismiss.callAsFunction)
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Spacer()
                }
                .padding(RememberDesign.spacingLarge)
            }
            .navigationTitle("Capture")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close", systemImage: "xmark", action: dismiss.callAsFunction) }
            }
            .task { inputFocused = true }
            .sensoryFeedback(.success, trigger: didSave)
        }
    }

    private func save() {
        guard let url = URLValidator.validatedWebURL(from: input) else {
            validationMessage = "Enter a complete https link."
            return
        }
        validationMessage = nil
        isSaving = true
        Task {
            do {
                try await store.capture(url)
                didSave = true
            } catch {
                validationMessage = "This link was not saved. (error.localizedDescription)"
            }
            isSaving = false
        }
    }
}
