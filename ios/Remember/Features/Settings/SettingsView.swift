import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var exportFormat: ExportFormat = .markdown
    @State private var exportDocument = ExportDocument(data: Data())
    @State private var exportIsPresented = false
    @State private var exportError: String?
    @State private var exportErrorIsPresented = false
    @State private var signOutIsPresented = false
    @State private var isSigningOut = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Sync", value: "Private cloud")
                    LabeledContent("Library", value: CountLabelFormatter.text(store.imprints.count, singular: "save"))
                    Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                        signOutIsPresented = true
                    }
                    .disabled(isSigningOut)
                }
                Section("Your data") {
                    Picker("Export format", selection: $exportFormat) {
                        ForEach(ExportFormat.allCases) { Text($0.rawValue.capitalized).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Button("Export data", systemImage: "square.and.arrow.up", action: prepareExport)
                    Text("Exports are not encrypted after you save them outside Remember.")
                        .font(.footnote)
                        .foregroundStyle(RememberDesign.secondaryText)
                }
                Section("Privacy and permissions") {
                    Label("Ask answers cite your saved sources", systemImage: "checkmark.shield")
                    Label("Health and Calendar access is optional", systemImage: "heart.text.square")
                    Button("Open system settings", systemImage: "gear") {
                        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                        openURL(url)
                    }
                }
                Section("About") {
                    LabeledContent("Version", value: versionLabel)
                    Text("Remember keeps your saves, plans, and personal data together.")
                        .foregroundStyle(RememberDesign.secondaryText)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: dismiss.callAsFunction)
                }
            }
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
            .confirmationDialog("Sign out of Remember?", isPresented: $signOutIsPresented, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) {
                    isSigningOut = true
                    Task {
                        await store.signOut()
                        isSigningOut = false
                    }
                }
                Button("Cancel", role: .cancel) { }
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
