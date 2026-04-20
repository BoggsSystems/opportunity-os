import SwiftUI
import UniformTypeIdentifiers

struct ContentDiscoveryView: View {
    @StateObject var viewModel: ContentDiscoveryViewModel
    @State private var isImporterPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Content Discovery")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text("Fresh signals and campaign angles, curated into one calm view.")
                        .foregroundStyle(AppTheme.mutedText)
                }

                if let statusMessage = viewModel.statusMessage {
                    statusCard(text: statusMessage, color: AppTheme.accent)
                }

                if let errorMessage = viewModel.errorMessage {
                    statusCard(text: errorMessage, color: .red)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Add Content")
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)

                    Text("Import a PDF to classify it and turn it into an outreach-ready content opportunity.")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.mutedText)

                    Button(viewModel.isUploading ? "Uploading..." : "Upload PDF") {
                        isImporterPresented = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)
                    .disabled(viewModel.isUploading)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(AppTheme.border))
                .shadow(color: AppTheme.shadow, radius: 18, y: 8)

                VStack(alignment: .leading, spacing: 14) {
                    Text("Discovered Content")
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(AppTheme.accent)
                    } else if viewModel.contentItems.isEmpty {
                        Text("No content has been discovered yet. Upload a PDF to seed the workflow.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    } else {
                        ForEach(viewModel.contentItems) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.title)
                                .font(.headline)
                                .foregroundStyle(AppTheme.primaryText)
                            Text(item.source)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                            if let linkedOfferingName = item.linkedOfferingName {
                                Text("Linked offering: \(linkedOfferingName)")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(AppTheme.accent)
                            }
                            if let fitScore = item.fitScore, let priorityScore = item.priorityScore {
                                Text("Fit \(fitScore) · Priority \(priorityScore)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.mutedText)
                            }
                            Text(item.campaignPotential)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)

                            Button(viewModel.executingItemIDs.contains(item.id) ? "Generating Targets..." : "Generate Outreach Targets") {
                                Task {
                                    await viewModel.executeContent(for: item)
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(AppTheme.accent)
                            .disabled(viewModel.executingItemIDs.contains(item.id))
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(AppTheme.border))
                        .shadow(color: AppTheme.shadow, radius: 18, y: 8)
                    }
                    }
                }

                VStack(alignment: .leading, spacing: 14) {
                    Text("Campaigns")
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)
                    if viewModel.campaigns.isEmpty {
                        Text("Campaigns will appear here as discovery work is promoted into outreach strategy.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    } else {
                        ForEach(viewModel.campaigns) { campaign in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(campaign.title)
                                .font(.headline)
                                .foregroundStyle(AppTheme.primaryText)
                            Text(campaign.strategicAngle ?? "No theme set")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(AppTheme.border))
                        .shadow(color: AppTheme.shadow, radius: 18, y: 8)
                    }
                    }
                }
            }
            .padding(20)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Content Discovery")
        .fileImporter(
            isPresented: $isImporterPresented,
            allowedContentTypes: [.pdf],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let fileURL = urls.first else { return }
                Task {
                    await viewModel.uploadContent(from: fileURL)
                }
            case .failure(let error):
                viewModel.errorMessage = error.localizedDescription
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private func statusCard(text: String, color: Color) -> some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(color)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(color.opacity(0.25)))
    }
}
