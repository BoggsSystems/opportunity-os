import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var cycle = PreviewData.cycle
    @Published var opportunities: [Opportunity] = []
    @Published var contentItems: [ContentItem] = []
    @Published var followUps: [FollowUpItem] = []
    @Published var headlinePrompt = PreviewData.cycle.recommendedPrompt
    @Published var isSpeaking = false

    private let opportunityService: OpportunityServiceProtocol
    private let followUpService: FollowUpServiceProtocol
    private let contentDiscoveryService: ContentDiscoveryServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let sessionManager: SessionManager

    init(
        opportunityService: OpportunityServiceProtocol,
        followUpService: FollowUpServiceProtocol,
        contentDiscoveryService: ContentDiscoveryServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        sessionManager: SessionManager
    ) {
        self.opportunityService = opportunityService
        self.followUpService = followUpService
        self.contentDiscoveryService = contentDiscoveryService
        self.speechSynthesisService = speechSynthesisService
        self.sessionManager = sessionManager
    }

    func load() async {
        opportunities = await opportunityService.fetchRecommendedOpportunities()
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        followUps = await followUpService.fetchFollowUps()
        if let firstOpportunity = opportunities.first {
            headlinePrompt = "I found: \(firstOpportunity.title). Would you like to act on it now?"
        }
    }

    func speakPrompt() {
        Task {
            isSpeaking = true
            await speechSynthesisService.speak(headlinePrompt, preference: sessionManager.voicePreference)
            isSpeaking = false
        }
    }
}
