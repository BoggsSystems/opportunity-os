import Foundation

final class AppContainer {
    let authService: AuthServiceProtocol
    let sessionManager: SessionManager
    let speechRecognitionService: SpeechRecognitionServiceProtocol
    let speechSynthesisService: SpeechSynthesisServiceProtocol
    let voicePreferenceService: VoicePreferenceServiceProtocol
    let opportunityService: OpportunityServiceProtocol
    let opportunityScanService: OpportunityScanServiceProtocol
    let followUpService: FollowUpServiceProtocol
    let messageDraftService: MessageDraftServiceProtocol
    let emailService: EmailServiceProtocol
    let campaignService: CampaignServiceProtocol
    let contentDiscoveryService: ContentDiscoveryServiceProtocol

    init(
        authService: AuthServiceProtocol,
        sessionManager: SessionManager,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        voicePreferenceService: VoicePreferenceServiceProtocol,
        opportunityService: OpportunityServiceProtocol,
        opportunityScanService: OpportunityScanServiceProtocol,
        followUpService: FollowUpServiceProtocol,
        messageDraftService: MessageDraftServiceProtocol,
        emailService: EmailServiceProtocol,
        campaignService: CampaignServiceProtocol,
        contentDiscoveryService: ContentDiscoveryServiceProtocol
    ) {
        self.authService = authService
        self.sessionManager = sessionManager
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
        self.voicePreferenceService = voicePreferenceService
        self.opportunityService = opportunityService
        self.opportunityScanService = opportunityScanService
        self.followUpService = followUpService
        self.messageDraftService = messageDraftService
        self.emailService = emailService
        self.campaignService = campaignService
        self.contentDiscoveryService = contentDiscoveryService
    }
}

extension AppContainer {
    static var preview: AppContainer {
        let sessionManager = SessionManager()
        let voicePreferenceService = StubVoicePreferenceService()
        return AppContainer(
            authService: StubAuthService(),
            sessionManager: sessionManager,
            speechRecognitionService: StubSpeechRecognitionService(),
            speechSynthesisService: StubSpeechSynthesisService(),
            voicePreferenceService: voicePreferenceService,
            opportunityService: StubOpportunityService(),
            opportunityScanService: StubOpportunityScanService(),
            followUpService: StubFollowUpService(),
            messageDraftService: StubMessageDraftService(),
            emailService: StubEmailService(),
            campaignService: StubCampaignService(),
            contentDiscoveryService: StubContentDiscoveryService()
        )
    }
}
