import Foundation

@MainActor
final class ContentDiscoveryViewModel: ObservableObject {
    @Published var contentItems: [ContentItem] = []
    @Published var campaigns: [Campaign] = []
    @Published var isLoading = false
    @Published var isUploading = false
    @Published var executingItemIDs: Set<UUID> = []
    @Published var statusMessage: String?
    @Published var errorMessage: String?

    private let contentDiscoveryService: ContentDiscoveryServiceProtocol
    private let campaignService: CampaignServiceProtocol

    init(
        contentDiscoveryService: ContentDiscoveryServiceProtocol,
        campaignService: CampaignServiceProtocol
    ) {
        self.contentDiscoveryService = contentDiscoveryService
        self.campaignService = campaignService
    }

    func load() async {
        isLoading = true
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        campaigns = await campaignService.fetchCampaigns()
        isLoading = false
    }

    func uploadContent(from fileURL: URL) async {
        isUploading = true
        errorMessage = nil
        defer { isUploading = false }

        do {
            let result = try await contentDiscoveryService.uploadContent(from: fileURL)
            statusMessage = "Uploaded \(result.title)."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func executeContent(for item: ContentItem) async {
        executingItemIDs.insert(item.id)
        errorMessage = nil
        defer { executingItemIDs.remove(item.id) }

        do {
            let result = try await contentDiscoveryService.executeContent(itemId: item.id, maxTargets: 3)
            statusMessage = "Generated \(result.targetCount) outreach target\(result.targetCount == 1 ? "" : "s") from \(item.title)."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearStatus() {
        statusMessage = nil
        errorMessage = nil
    }
}
