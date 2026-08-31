import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var exportFormat: ExportFormat = .markdown
    @State private var exportDocument = ExportDocument(data: Data())
    @State private var exportIsPresented = false
    @State private var exportError: String?
    @State private var exportErrorIsPresented = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("Settings")
                    .font(.largeTitle)
                    .bold()
                    .padding(.horizontal, RememberDesign.spacing)
                    .padding(.top, RememberDesign.spacingSmall)
                Form {
                    Section("Account") {
                        LabeledContent("Sync", value: "Private cloud")
                        LabeledContent("Knowledge", value: CountLabelFormatter.text(store.imprints.count, singular: "imprint"))
                        Text("Your iPhone and web Personal Life OS stay in sync.")
                            .font(.footnote)
                            .foregroundStyle(RememberDesign.secondaryText)
                        Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                            Task { await store.signOut() }
                        }
                    }
                    Section("Data") {
                        Picker("Export format", selection: $exportFormat) {
                            ForEach(ExportFormat.allCases) { Text($0.rawValue.capitalized).tag($0) }
                        }
                        Button("Export my data", systemImage: "square.and.arrow.up", action: prepareExport)
                    }
                    Section("Privacy") {
                        Label("Personal-relevance guesses are labeled as hypotheses", systemImage: "checkmark.shield")
                        Label("Original links are preserved", systemImage: "link")
                        Label("Ask answers cite only your saved sources", systemImage: "lock")
                        Label("Health and Calendar access is permission-controlled", systemImage: "heart.text.square")
                    }
                    Section("About") {
                        LabeledContent("Version", value: versionLabel)
                        Text("Remember, decide, act, and reset—with your life back in view.")
                            .foregroundStyle(RememberDesign.secondaryText)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .fileExporter(
                isPresented: $exportIsPresented,
                document: exportDocument,
                contentType: exportFormat == .json ? .json : .plainText,
                defaultFilename: "remember-export.\(exportFormat.fileExtension)"
            ) { result in
                if case .failure(let error) = result {
                    exportError = error.localizedDescription
                    exportErrorIsPresented = true
                }
            }
            .alert("Export failed", isPresented: $exportErrorIsPresented) { } message: {
                Text(exportError ?? "Please try again.")
            }
        }
    }

    private var versionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Unknown"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "Unknown"
        return "\(version) (\(build))"
    }

    private func prepareExport() {
        do {
            exportDocument = ExportDocument(data: try LibraryExporter.data(for: store.imprints, life: store.lifeSnapshot, format: exportFormat))
            exportIsPresented = true
        } catch {
            exportError = error.localizedDescription
            exportErrorIsPresented = true
        }
    }
}
