import SwiftUI

@MainActor
final class RootCoordinator: ObservableObject {
    let container: AppContainer
    @Published var unifiedViewModel: UnifiedAssistantViewModel

    init(container: AppContainer) {
        self.container = container
        self.unifiedViewModel = UnifiedAssistantViewModel(
            opportunityService: container.opportunityService,
            nextActionService: container.nextActionService,
            followUpService: container.followUpService,
            contentDiscoveryService: container.contentDiscoveryService,
            speechSynthesisService: container.speechSynthesisService,
            speechRecognitionService: container.speechRecognitionService,
            assistantConversationService: container.assistantConversationService,
            messageDraftService: container.messageDraftService,
            emailService: container.emailService,
            authService: container.authService,
            strategyService: container.onboardingService,
            goalService: container.goalService,
            campaignService: container.campaignService,
            debugService: container.remoteDebugService,
            voicePreferenceService: container.voicePreferenceService,
            assistantSocketService: container.assistantSocketService,
            sessionManager: container.sessionManager,
            apiClient: container.apiClient
        )
        debugTrace("RootCoordinator", "initialized with Unified Assistant architecture")
    }

    @ViewBuilder
    func view() -> some View {
        MainTabView(viewModel: self.unifiedViewModel)
    }
}
