import Foundation

final class AppContainer {
    let authService: AuthServiceProtocol
    let sessionManager: SessionManager
    let speechRecognitionService: SpeechRecognitionServiceProtocol
    let speechSynthesisService: SpeechSynthesisServiceProtocol
    let voicePreferenceService: VoicePreferenceServiceProtocol
    let assistantConversationService: AssistantConversationServiceProtocol
    let opportunityService: OpportunityServiceProtocol
    let nextActionService: NextActionServiceProtocol
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
        assistantConversationService: AssistantConversationServiceProtocol,
        opportunityService: OpportunityServiceProtocol,
        nextActionService: NextActionServiceProtocol,
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
        self.assistantConversationService = assistantConversationService
        self.opportunityService = opportunityService
        self.nextActionService = nextActionService
        self.opportunityScanService = opportunityScanService
        self.followUpService = followUpService
        self.messageDraftService = messageDraftService
        self.emailService = emailService
        self.campaignService = campaignService
        self.contentDiscoveryService = contentDiscoveryService
    }
}

@MainActor
extension AppContainer {
    private enum UITestEnvironment {
        static let mode = "UI_TEST_MODE"
        static let suite = "UI_TEST_SUITE"
        static let authState = "UI_TEST_AUTH_STATE"
        static let spokenTurns = "UI_TEST_SPOKEN_TURNS"
        static let useRealAI = "UI_TEST_USE_REAL_AI"
    }

    private static func makePreviewSession(for email: String = PreviewData.user.email) -> AuthSession {
        let user = User(
            id: UUID(),
            firstName: PreviewData.user.firstName,
            lastName: PreviewData.user.lastName,
            email: email,
            preferredInteractionMode: PreviewData.user.preferredInteractionMode
        )
        return AuthSession(
            accessToken: "ui-test-token",
            refreshToken: "ui-test-refresh-token",
            sessionId: UUID().uuidString,
            user: user,
            startedAt: Date()
        )
    }

    private static func makeAuthService() -> AuthServiceProtocol {
        if ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1" {
            return StubAuthService()
        }

        return RemoteAuthService(client: OpportunityOSAPIClient())
    }

    private static func makeSessionManager() -> SessionManager {
        let environment = ProcessInfo.processInfo.environment
        let suiteName = environment[UITestEnvironment.suite]
        let defaults = suiteName.flatMap(UserDefaults.init(suiteName:)) ?? .standard

        if environment[UITestEnvironment.mode] == "1", let suiteName {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let sessionManager = SessionManager(defaults: defaults)

        guard environment[UITestEnvironment.mode] == "1" else {
            return sessionManager
        }

        switch environment[UITestEnvironment.authState] {
        case "signed_in":
            sessionManager.start(session: makePreviewSession())
        case "signed_out":
            sessionManager.start(session: makePreviewSession())
            sessionManager.clear()
        default:
            break
        }

        return sessionManager
    }

    static var preview: AppContainer {
        let sessionManager = makeSessionManager()
        let environment = ProcessInfo.processInfo.environment
        let isUITestMode = environment[UITestEnvironment.mode] == "1"
        let shouldUseRealAIInUITests = environment[UITestEnvironment.useRealAI] == "1"
        let voicePreferenceService: VoicePreferenceServiceProtocol = isUITestMode
            ? StubVoicePreferenceService()
            : LocalVoicePreferenceService()
        let apiClient = OpportunityOSAPIClient()
        return AppContainer(
            authService: makeAuthService(),
            sessionManager: sessionManager,
            speechRecognitionService: isUITestMode
                ? StubSpeechRecognitionService(seedInput: environment[UITestEnvironment.spokenTurns])
                : NativeSpeechRecognitionService(),
            speechSynthesisService: isUITestMode
                ? StubSpeechSynthesisService()
                : NativeSpeechSynthesisService(),
            voicePreferenceService: voicePreferenceService,
            assistantConversationService: isUITestMode && !shouldUseRealAIInUITests
                ? StubAssistantConversationService()
                : RemoteAssistantConversationService(client: apiClient, sessionManager: sessionManager),
            opportunityService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubOpportunityService()
                : RemoteOpportunityService(client: apiClient, sessionManager: sessionManager),
            nextActionService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubNextActionService()
                : RemoteNextActionService(client: apiClient, sessionManager: sessionManager),
            opportunityScanService: StubOpportunityScanService(),
            followUpService: StubFollowUpService(),
            messageDraftService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubMessageDraftService()
                : RemoteMessageDraftService(client: apiClient, sessionManager: sessionManager),
            emailService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubEmailService()
                : RemoteEmailService(client: apiClient, sessionManager: sessionManager),
            campaignService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubCampaignService()
                : RemoteCampaignService(),
            contentDiscoveryService: ProcessInfo.processInfo.environment[UITestEnvironment.mode] == "1"
                ? StubContentDiscoveryService()
                : RemoteContentDiscoveryService(client: apiClient, sessionManager: sessionManager)
        )
    }
}
