import SwiftUI
import UniformTypeIdentifiers

struct LifeFilesView: View {
    @Environment(AppStore.self) private var store
    @State private var searchText = ""
    @State private var importerIsPresented = false
    @State private var importError: String?

    private var files: [LifeVaultFile] {
        guard !searchText.isEmpty else { return store.lifeSnapshot.files }
        return store.lifeSnapshot.files.filter { file in
            [file.name, file.folder, file.summary, file.tags.joined(separator: " ")].contains { $0.localizedStandardContains(searchText) }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                VStack(alignment: .leading, spacing: RememberDesign.spacing) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("PRIVATE VAULT").font(.caption2.bold()).foregroundStyle(RememberDesign.accent)
                            Text("Your files, in context.").font(.largeTitle.bold())
                            Text("Documents that belong beside your plans and memories.").font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                        }
                        Spacer()
                        Button("Upload", systemImage: "square.and.arrow.up") { importerIsPresented = true }
                            .buttonStyle(.borderedProminent)
                            .buttonBorderShape(.capsule)
                            .tint(RememberDesign.accent)
                            .foregroundStyle(RememberDesign.accentInk)
                    }
                    TextField("Search files, folders, or tags", text: $searchText)
                        .textFieldStyle(.roundedBorder)
                    if let importError { Label(importError, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(RememberDesign.danger) }
                    if files.isEmpty {
                        ContentUnavailableView(searchText.isEmpty ? "The vault is empty" : "No matching files", systemImage: "folder", description: Text(searchText.isEmpty ? "Upload a plan, receipt, export, or document to keep it beside the rest of your life." : "Try another name, folder, or tag."))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(files) { file in
                                    HStack(spacing: 14) {
                                        Image(systemName: "doc.fill").font(.title2).foregroundStyle(RememberDesign.accent).frame(width: 42, height: 42).background(RememberDesign.surfaceRaised, in: RoundedRectangle(cornerRadius: 12))
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(file.name).font(.subheadline.bold()).lineLimit(1)
                                            Text("\(file.folder.isEmpty ? "Vault" : file.folder) · \(ByteCountFormatter.string(fromByteCount: Int64(file.sizeBytes), countStyle: .file))")
                                                .font(.caption).foregroundStyle(RememberDesign.secondaryText)
                                            if !file.summary.isEmpty { Text(file.summary).font(.caption).foregroundStyle(RememberDesign.secondaryText).lineLimit(2) }
                                        }
                                        Spacer()
                                    }
                                    .padding(16)
                                    .background(RememberDesign.surface, in: RoundedRectangle(cornerRadius: 17))
                                }
                            }
                            .padding(.bottom, 96)
                        }
                        .refreshable { await store.loadLife() }
                    }
                }
                .padding(RememberDesign.spacing)
            }
            .toolbar(.hidden, for: .navigationBar)
            .fileImporter(isPresented: $importerIsPresented, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
                guard case let .success(urls) = result, let url = urls.first else {
                    if case let .failure(error) = result { importError = error.localizedDescription }
                    return
                }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                do {
                    let data = try Data(contentsOf: url, options: .mappedIfSafe)
                    guard data.count <= 25 * 1_024 * 1_024 else { importError = "Files must be 25 MB or smaller."; return }
                    let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                    importError = nil
                    Task { await store.uploadLifeFile(data: data, name: url.lastPathComponent, mimeType: mimeType) }
                } catch { importError = "Remember could not read that file." }
            }
        }
    }
}
