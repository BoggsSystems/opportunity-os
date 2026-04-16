import Foundation

@MainActor
final class ContentDiscoveryViewModel: ObservableObject {
    @Published var contentItems: [ContentItem] = []
    @Published var campaigns: [Campaign] = []

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
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        campaigns = await campaignService.fetchCampaigns()
    }
}
