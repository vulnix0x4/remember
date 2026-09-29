import SwiftUI

struct BringBackSection: View {
    let imprint: Imprint
    @Environment(AppStore.self) private var store
    @State private var selection: ReturnCue?
    @State private var returnDate: Date
    @State private var isSaving = false
    @State private var message: String?
    @State private var errorMessage: String?

    init(imprint: Imprint) {
        self.imprint = imprint
        _selection = State(initialValue: imprint.returnCue)
        _returnDate = State(initialValue: imprint.returnAt ?? ReturnSchedule.tomorrow())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            Text("Bring it back when…")
                .font(.rememberSectionTitle)
                .accessibilityAddTraits(.isHeader)
            ReturnCuePicker(selection: selection, returnDate: returnDate, onSelect: choose, onDateChange: changeDate)
            if selection == .date {
                Button(isSaving ? "Saving…" : "Set return day") { Task { await persist(.date, at: returnDate) } }
                    .buttonStyle(.rememberSecondary)
                    .disabled(isSaving)
            }
            if let message { Label(message, systemImage: "checkmark.circle.fill").font(.rememberMeta).foregroundStyle(RememberDesign.text2) }
            if let errorMessage { Label(errorMessage, systemImage: "exclamationmark.circle.fill").font(.rememberMeta).foregroundStyle(RememberDesign.danger) }
        }
        .rememberCard(padding: RememberDesign.spacing + 4)
        .onChange(of: imprint.returnCue) { _, value in selection = value }
        .onChange(of: imprint.returnAt) { _, value in if let value { returnDate = value } }
    }

    private func choose(_ cue: ReturnCue?) {
        selection = cue
        message = nil
        errorMessage = nil
        guard cue != .date else { return }
        Task { await persist(cue, at: nil) }
    }

    private func changeDate(_ date: Date) { returnDate = date; message = nil }

    @MainActor
    private func persist(_ cue: ReturnCue?, at date: Date?) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await store.setReturnCue(for: imprint, cue: cue, returnAt: cue == .date ? try ReturnSchedule.instant(for: date ?? returnDate) : nil)
            message = cue.map { "Ready for \($0.label.lowercased())." } ?? "Return cue removed."
        } catch {
            errorMessage = (error as? ReturnSchedule.InvalidDay)?.errorDescription ?? "Remember couldn’t save that return moment."
        }
    }
}
