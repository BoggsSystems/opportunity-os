import SwiftUI
import UniformTypeIdentifiers

struct AssetVaultView: View {
    @StateObject private var viewModel: AssetVaultViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingFilePicker = false
    @State private var selectedCategory: AssetCategory = .resume

    init(apiClient: OpportunityOSAPIClient, sessionManager: SessionManager) {
        _viewModel = StateObject(wrappedValue: AssetVaultViewModel(apiClient: apiClient, sessionManager: sessionManager))
    }

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.pageBackground.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Category Selector
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(AssetCategory.allCases, id: \.self) { category in
                                FilterChip(
                                    title: category.displayName,
                                    isSelected: selectedCategory == category,
                                    action: { selectedCategory = category }
                                )
                            }
                        }
                        .padding()
                    }
                    
                    if viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if viewModel.assets.isEmpty {
                        EmptyStateView(
                            icon: "folder.badge.plus",
                            title: "Your Vault is Empty",
                            subtitle: "Upload your resumes, books, or briefs to give the AI strategic context for your outreach.",
                            actionTitle: "Upload First Asset",
                            action: { showingFilePicker = true }
                        )
                    } else {
                        List {
                            ForEach(viewModel.assets.filter { $0.category == selectedCategory }) { asset in
                                AssetRow(asset: asset)
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                                    .padding(.vertical, 4)
                            }
                        }
                        .listStyle(.plain)
                        .refreshable {
                            await viewModel.fetchAssets()
                        }
                    }
                }
                
                // Upload Overlay
                if viewModel.isUploading {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .overlay(
                            VStack(spacing: 16) {
                                ProgressView()
                                    .scaleEffect(1.5)
                                Text("Analyzing Strategic Narrative...")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                            }
                            .padding(32)
                            .background(AppTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                        )
                }
            }
            .navigationTitle("Asset Vault")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingFilePicker = true }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(AppTheme.accent)
                    }
                }
            }
            .fileImporter(
                isPresented: $showingFilePicker,
                allowedContentTypes: [.pdf, .rtf, .plainText, UTType(filenameExtension: "docx")!],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    if let url = urls.first {
                        viewModel.uploadFile(at: url, category: selectedCategory)
                    }
                case .failure(let error):
                    debugTrace("AssetVault", "File picker failed: \(error.localizedDescription)")
                }
            }
            .alert("Error", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }
}

// MARK: - Components

struct AssetRow: View {
    let asset: UserAsset
    @State private var isExpanded = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                // Icon based on type
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(AppTheme.accentSoft.opacity(0.5))
                        .frame(width: 44, height: 44)
                    Image(systemName: "doc.text.fill")
                        .foregroundStyle(AppTheme.accent)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(asset.displayName)
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)
                    Text(asset.fileName)
                        .font(.caption)
                        .foregroundStyle(AppTheme.mutedText)
                }
                
                Spacer()
                
                Button(action: { withAnimation { isExpanded.toggle() } }) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.bold())
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            
            if isExpanded, let narrative = asset.narrative {
                VStack(alignment: .leading, spacing: 12) {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("STRATEGIC VALUE PROP")
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(AppTheme.accent)
                        Text(narrative.valueProposition ?? "Analysis pending...")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(AppTheme.primaryText)
                    }
                    
                    if let points = narrative.keyProofPoints, !points.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("KEY PROOF POINTS")
                                .font(.system(size: 8, weight: .black))
                                .foregroundStyle(AppTheme.accent)
                            ForEach(points, id: \.self) { point in
                                HStack(alignment: .top, spacing: 6) {
                                    Text("•").bold()
                                    Text(point)
                                        .font(.system(size: 12))
                                }
                                .foregroundStyle(AppTheme.primaryText)
                            }
                        }
                    }
                }
                .padding(.top, 4)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding()
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? AppTheme.accent : AppTheme.surface)
                .foregroundStyle(isSelected ? .white : AppTheme.primaryText)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : AppTheme.border, lineWidth: 1)
                )
        }
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    let actionTitle: String
    let action: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundStyle(AppTheme.mutedText.opacity(0.5))
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 40)
            
            Button(action: action) {
                Text(actionTitle)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(AppTheme.accent)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - View Model

class AssetVaultViewModel: ObservableObject {
    @Published var assets: [UserAsset] = []
    @Published var isLoading = false
    @Published var isUploading = false
    @Published var errorMessage: String?
    
    private let apiClient: OpportunityOSAPIClient
    private let sessionManager: SessionManager
    
    init(apiClient: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.apiClient = apiClient
        self.sessionManager = sessionManager
        Task { await fetchAssets() }
    }
    
    @MainActor
    func fetchAssets() async {
        isLoading = true
        do {
            let response: AssetListResponse = try await apiClient.get("assets", accessToken: sessionManager.session?.accessToken)
            self.assets = response.assets
        } catch {
            errorMessage = "Failed to fetch assets: \(error.localizedDescription)"
        }
        isLoading = false
    }
    
    func uploadFile(at url: URL, category: AssetCategory) {
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        
        Task {
            await MainActor.run { isUploading = true }
            
            do {
                let fileData = try Data(contentsOf: url)
                let fileName = url.lastPathComponent
                let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                
                let response: AssetUploadResponse = try await apiClient.postMultipart(
                    "assets/upload",
                    fields: ["category": category.rawValue],
                    fileFieldName: "file",
                    fileName: fileName,
                    mimeType: mimeType,
                    fileData: fileData,
                    accessToken: sessionManager.session?.accessToken
                )
                
                await MainActor.run {
                    if response.success {
                        self.assets.insert(response.asset, at: 0)
                    }
                    isUploading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Upload failed: \(error.localizedDescription)"
                    isUploading = false
                }
            }
        }
    }
}

struct AssetListResponse: Decodable {
    let success: Bool
    let assets: [UserAsset]
}

struct AssetUploadResponse: Decodable {
    let success: Bool
    let asset: UserAsset
}
