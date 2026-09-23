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
        VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
            HStack(alignment: .top, spacing: RememberDesign.spacingCompact) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.title3)
                    .foregroundStyle(RememberDesign.accent)
                    .frame(width: 44, height: 44)
                    .background(RememberDesign.mutedFill, in: .rect(cornerRadius: RememberDesign.controlRadius))
                VStack(alignment: .leading, spacing: RememberDesign.spacingXXSmall) {
                    Text("Bring this back when it can help").font(.title3.bold())
                    Text("Tell Remember the kind of moment this idea belongs in.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                }
            }
            ReturnCuePicker(selection: selection, returnDate: returnDate, onSelect: choose, onDateChange: changeDate)
            if selection == .date {
                Button(isSaving ? "Saving…" : "Set return day") { Task { await persist(.date, at: returnDate) } }
                    .buttonStyle(.borderedProminent)
                    .tint(RememberDesign.accent)
                    .foregroundStyle(RememberDesign.accentInk)
                    .disabled(isSaving)
            }
            if let message { Label(message, systemImage: "checkmark.circle.fill").font(.footnote.bold()).foregroundStyle(RememberDesign.accent) }
            if let errorMessage { Label(errorMessage, systemImage: "exclamationmark.circle.fill").font(.footnote).foregroundStyle(RememberDesign.danger) }
        }
        .rememberSurface()
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
