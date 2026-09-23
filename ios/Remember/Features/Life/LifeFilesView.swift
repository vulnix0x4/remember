import SwiftUI
import UniformTypeIdentifiers

struct LifeFilesView: View {
    @Environment(AppStore.self) private var store
    @Binding private var lifeSection: LifeSection
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var searchText = ""
    @State private var importerIsPresented = false
    @State private var importError: String?
    @State private var isUploading = false
    @State private var downloadingID: UUID?
    @State private var pendingImportURL: URL?
    @State private var pendingUploadData: Data?
    @State private var pendingUploadName = ""
    @State private var pendingUploadMimeType = "application/octet-stream"
    @State private var pendingDownload: LifeVaultFile?
    @State private var uploadFeedback = 0
    @State private var exportDocument = ExportDocument(data: Data())
    @State private var exportIsPresented = false
    @State private var exportFilename = "Remember file"
    @State private var exportType = UTType.data
    @State private var pendingDeletion: LifeVaultFile?
    @AccessibilityFocusState private var fileErrorIsFocused: Bool
    @AccessibilityFocusState private var downloadStatusFocusedID: UUID?

    init(lifeSection: Binding<LifeSection> = .constant(.files)) {
        _lifeSection = lifeSection
    }

    private var files: [LifeVaultFile] {
        guard !searchText.isEmpty else { return store.lifeSnapshot.files }
        return store.lifeSnapshot.files.filter { file in
            [file.name, file.folder, file.summary, file.tags.joined(separator: " ")]
                .contains { $0.localizedStandardContains(searchText) }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                AdaptiveSectionControl(
                    selection: $lifeSection,
                    choices: LifeSection.allCases,
                    accessibilityIdentifier: "remember.section.life",
                    title: { $0.rawValue }
                )
                Group {
                    if files.isEmpty {
                    ContentUnavailableView {
                        Label(searchText.isEmpty ? "No files yet" : "No matching files", systemImage: "folder")
                    } description: {
                        Text(searchText.isEmpty ? "Upload a document to keep it with the rest of your information." : "Try another name, folder, or tag.")
                    }
                    } else {
                        List(files) { file in
                        Button {
                            download(file)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: symbol(for: file.mimeType))
                                    .font(.title3)
                                    .foregroundStyle(RememberDesign.accent)
                                    .frame(width: 36, height: 36)
                                    .background(RememberDesign.mutedFill, in: .rect(cornerRadius: 10))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(file.name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)
                                        .lineLimit(2)
                                    Text("\(file.folder.isEmpty ? "Files" : file.folder) · \(ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes), countStyle: .file))")
                                        .font(.caption)
                                        .foregroundStyle(RememberDesign.secondaryText)
                                    if !file.summary.isEmpty {
                                        Text(file.summary)
                                            .font(.caption)
                                            .foregroundStyle(RememberDesign.secondaryText)
                                            .lineLimit(2)
                                    }
                                }
                                Spacer()
                                if downloadingID == file.id {
                                    ProgressView()
                                        .controlSize(.small)
                                        .accessibilityHidden(true)
                                } else {
                                    Image(systemName: "arrow.down.circle")
                                        .foregroundStyle(RememberDesign.accent)
                                        .accessibilityHidden(true)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                        .disabled(downloadingID != nil)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(downloadingID == file.id ? "Downloading \(file.name)" : file.name)
                        .accessibilityValue(fileAccessibilityValue(file))
                        .accessibilityHint(downloadingID == nil ? "Downloads this file" : "")
                        .accessibilityFocused($downloadStatusFocusedID, equals: file.id)
                        .swipeActions {
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                pendingDeletion = file
                            }
                        }
                        .contextMenu {
                            Button("Download", systemImage: "arrow.down.circle") { download(file) }
                            Button("Delete", systemImage: "trash", role: .destructive) { pendingDeletion = file }
                        }
                    }
                        .listStyle(.plain)
                        .refreshable { await store.loadLife() }
                    }
                }
            }
            .navigationTitle("Files")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Search files")
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    if let importError { fileErrorView(importError) }
                    QuickAddBar(title: isUploading ? "Uploading…" : "Upload a file", systemImage: "square.and.arrow.up") {
                        importerIsPresented = true
                    }
                    .disabled(isUploading)
                }
            }
            .fileImporter(isPresented: $importerIsPresented, allowedContentTypes: [.data], allowsMultipleSelection: false, onCompletion: importFile)
            .fileExporter(
                isPresented: $exportIsPresented,
                document: exportDocument,
                contentType: exportType,
                defaultFilename: exportFilename
            ) { result in
                switch result {
                case .success:
                    pendingDownload = nil
                case .failure(let error):
                    presentFileError("The downloaded file could not be saved. \(error.localizedDescription)")
                }
            }
            .alert("Delete file?", isPresented: deletionIsPresented) {
                Button("Delete", role: .destructive) {
                    guard let pendingDeletion else { return }
                    Task { await store.deleteLifeFile(pendingDeletion) }
                    self.pendingDeletion = nil
                }
                Button("Cancel", role: .cancel) { pendingDeletion = nil }
            } message: {
                Text("This permanently removes \(pendingDeletion?.name ?? "this file") from Remember.")
            }
            .sensoryFeedback(.success, trigger: uploadFeedback)
            .rememberPrimaryActions()
        }
    }

    private func fileErrorView(_ message: String) -> some View {
        let actionLayout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: RememberDesign.spacingSmall))
            : AnyLayout(HStackLayout(spacing: RememberDesign.spacingSmall))

        return VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            Label(message, systemImage: "exclamationmark.circle.fill")
                .font(.footnote)
                .foregroundStyle(RememberDesign.danger)
                .accessibilityFocused($fileErrorIsFocused)

            actionLayout {
                if canRetryFileAction {
                    Button(retryActionTitle, systemImage: "arrow.clockwise", action: retryFileAction)
                        .buttonStyle(.borderedProminent)
                        .tint(RememberDesign.accent)
                        .foregroundStyle(RememberDesign.accentInk)
                        .disabled(isUploading || downloadingID != nil)
                }
                Button("Dismiss") {
                    importError = nil
                    fileErrorIsFocused = false
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(RememberDesign.spacing)
        .background(.bar, in: .rect(cornerRadius: RememberDesign.cornerRadius))
        .padding(RememberDesign.spacing)
    }

    private var deletionIsPresented: Binding<Bool> {
        Binding(
            get: { pendingDeletion != nil },
            set: { if !$0 { pendingDeletion = nil } }
        )
    }

    private func symbol(for mimeType: String) -> String {
        if mimeType.hasPrefix("image/") { return "photo" }
        if mimeType == "application/pdf" { return "doc.richtext" }
        if mimeType.hasPrefix("audio/") { return "waveform" }
        if mimeType.hasPrefix("video/") { return "video" }
        return "doc"
    }

    private func importFile(_ result: Result<[URL], Error>) {
        guard case let .success(urls) = result, let url = urls.first else {
            if case let .failure(error) = result {
                presentFileError("Remember could not open the file picker result. \(error.localizedDescription)")
            }
            return
        }
        pendingDownload = nil
        pendingUploadData = nil
        pendingImportURL = url
        prepareUpload(from: url)
    }

    private func prepareUpload(from url: URL) {
        guard !isUploading else { return }
        isUploading = true
        clearFileError()
        Task {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try await Task.detached(priority: .userInitiated) {
                    try Data(contentsOf: url, options: .mappedIfSafe)
                }.value
                guard data.count <= 25 * 1_024 * 1_024 else {
                    pendingImportURL = nil
                    pendingUploadData = nil
                    isUploading = false
                    presentFileError("Files must be 25 MB or smaller. Choose a smaller file and try again.")
                    return
                }
                let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                pendingUploadData = data
                pendingUploadName = url.lastPathComponent
                pendingUploadMimeType = mimeType
                await finishUpload(data: data, name: pendingUploadName, mimeType: mimeType)
            } catch {
                isUploading = false
                presentFileError("Remember could not read that file. Check that it is still available and try again.")
            }
        }
    }

    private func retryPendingUpload() {
        guard let data = pendingUploadData, !isUploading else { return }
        isUploading = true
        clearFileError()
        Task {
            await finishUpload(data: data, name: pendingUploadName, mimeType: pendingUploadMimeType)
        }
    }

    private func finishUpload(data: Data, name: String, mimeType: String) async {
        let succeeded = await store.uploadLifeFile(data: data, name: name, mimeType: mimeType)
        isUploading = false
        if succeeded {
            pendingImportURL = nil
            pendingUploadData = nil
            pendingUploadName = ""
            pendingUploadMimeType = "application/octet-stream"
            uploadFeedback += 1
        } else {
            presentFileError("That file could not be uploaded. Check your connection and try again. The selected file is still ready.")
        }
    }

    private func download(_ file: LifeVaultFile) {
        guard downloadingID == nil else { return }
        pendingImportURL = nil
        pendingUploadData = nil
        pendingDownload = file
        downloadingID = file.id
        clearFileError()
        downloadStatusFocusedID = file.id
        Task {
            do {
                exportDocument = ExportDocument(data: try await store.downloadLifeFile(file))
                exportFilename = file.name
                exportType = UTType(mimeType: file.mimeType) ?? .data
                exportIsPresented = true
            } catch {
                presentFileError("That file could not be downloaded. Check your connection and try again.")
            }
            downloadingID = nil
            downloadStatusFocusedID = nil
        }
    }

    private var canRetryFileAction: Bool {
        pendingUploadData != nil || pendingImportURL != nil || pendingDownload != nil
    }

    private var retryActionTitle: String {
        if pendingUploadData != nil { return "Try upload again" }
        if pendingImportURL != nil { return "Try reading again" }
        return "Try download again"
    }

    private func retryFileAction() {
        if pendingUploadData != nil {
            retryPendingUpload()
        } else if let pendingImportURL {
            prepareUpload(from: pendingImportURL)
        } else if let pendingDownload {
            download(pendingDownload)
        }
    }

    private func fileAccessibilityValue(_ file: LifeVaultFile) -> String {
        if downloadingID == file.id { return "Download in progress" }
        let folder = file.folder.isEmpty ? "Files" : file.folder
        let size = ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes), countStyle: .file)
        return "\(folder), \(size)"
    }

    private func presentFileError(_ message: String) {
        importError = message
        fileErrorIsFocused = true
    }

    private func clearFileError() {
        importError = nil
        fileErrorIsFocused = false
    }
}
