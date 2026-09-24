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
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingLarge) {
                    Text("Settings")
                        .font(.rememberScreenTitle)
                        .accessibilityAddTraits(.isHeader)

                    settingsSection("Your day", detail: "When Jev can plan things") { YourDaySection() }
                    settingsSection("Commitments", detail: "Things you do most days, like college or the gym") { CommitmentsSection(kind: .commitment) }
                    settingsSection("Chores", detail: "Things that keep life running. They repeat on their own.") { CommitmentsSection(kind: .chore) }
                    settingsSection("Focus mode", detail: nil) { FocusModeSection() }
                    settingsSection("Nudges", detail: nil) { NudgesSection() }
                    settingsSection("About me for Jev", detail: "Anything that helps Jev plan for you") { AboutMeSection() }

                    Button("Run setup again", systemImage: "sparkles") {
                        dismiss()
                        SetupProgress.reset()
                        store.setupIsPresented = true
                    }
                    .buttonStyle(.rememberSecondary)

                    VStack(spacing: 0) {
                        row("Sync", value: "Private cloud")
                        divider
                        row("Library", value: CountLabelFormatter.text(store.imprints.count, singular: "save"))
                        divider
                        row("Version", value: versionLabel)
                    }
                    .rememberCard(padding: RememberDesign.spacing)

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        SectionHeading(title: "Your data")
                        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                            formatPicker
                            Button("Export data", systemImage: "square.and.arrow.up", action: prepareExport)
                                .buttonStyle(.rememberSecondary)
                            Text("Exports aren’t encrypted once saved elsewhere.")
                                .font(.rememberMeta)
                                .foregroundStyle(RememberDesign.text3)
                        }
                        .rememberCard(padding: RememberDesign.spacing)
                    }

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        SectionHeading(title: "Privacy")
                        VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                            Label("Ask answers cite your saves", systemImage: "checkmark.shield")
                            Label("Health and Calendar are optional", systemImage: "heart.text.square")
                            Button("Open system settings", systemImage: "gear") {
                                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                                openURL(url)
                            }
                            .buttonStyle(.rememberSecondary)
                        }
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                        .rememberCard(padding: RememberDesign.spacing)
                    }

                    Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                        signOutIsPresented = true
                    }
                    .buttonStyle(.rememberDanger)
                    .frame(maxWidth: .infinity)
                    .disabled(isSigningOut)
                }
                .padding(.horizontal, RememberDesign.spacing)
                .padding(.bottom, RememberDesign.spacingXLarge)
            }
            .background(RememberDesign.canvas)
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
        .presentationDragIndicator(.visible)
        .presentationBackground(RememberDesign.canvas)
        .presentationCornerRadius(RememberDesign.sheetRadius)
    }

    private func settingsSection<Content: View>(_ title: String, detail: String?, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.rememberSectionTitle).accessibilityAddTraits(.isHeader)
                if let detail {
                    Text(detail).font(.footnote).foregroundStyle(RememberDesign.text3)
                }
            }
            content()
        }
    }

    private var divider: some View {
        Rectangle().fill(RememberDesign.line).frame(height: 1).accessibilityHidden(true)
    }

    private func row(_ title: String, value: String) -> some View {
        LabeledContent {
            Text(value).foregroundStyle(RememberDesign.text2)
        } label: {
            Text(title).font(.body.weight(.medium))
        }
        .frame(minHeight: 48)
    }

    private var formatPicker: some View {
        HStack(spacing: 4) {
            ForEach(ExportFormat.allCases) { format in
                let isSelected = exportFormat == format
                Button {
                    exportFormat = format
                } label: {
                    Text(format == .json ? "JSON" : "Markdown")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isSelected ? RememberDesign.canvas : RememberDesign.text2)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(isSelected ? RememberDesign.primaryFill : Color.clear, in: .capsule)
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(4)
        .background(RememberDesign.cardRaised, in: .capsule)
        .accessibilityLabel("Export format")
        .sensoryFeedback(.selection, trigger: exportFormat)
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
