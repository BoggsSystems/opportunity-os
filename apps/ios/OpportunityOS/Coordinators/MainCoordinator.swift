import SwiftUI

enum MainRoute: Hashable {
    case opportunityList
    case opportunityDetail(Opportunity)
    case contentDiscovery
    case messageDraft(Opportunity)
    case sendConfirmation(OutreachMessage)
    case sendSuccess(OutreachMessage)
    case settings
    case voiceSettings
}

@MainActor
final class MainCoordinator: ObservableObject {
    let container: AppContainer
    @Published var path: [MainRoute] = []
    var onSignOut: (() -> Void)?

    init(container: AppContainer) {
        self.container = container
    }

    @ViewBuilder
    func view() -> some View {
        NavigationStack(path: $path) {
            HomeView(
                viewModel: HomeViewModel(
                    opportunityService: container.opportunityService,
                    followUpService: container.followUpService,
                    contentDiscoveryService: container.contentDiscoveryService,
                    speechSynthesisService: container.speechSynthesisService,
                    sessionManager: container.sessionManager
                ),
                onOpenOpportunities: { [weak self] in self?.path.append(.opportunityList) },
                onOpenContent: { [weak self] in self?.path.append(.contentDiscovery) },
                onContinueCycle: { [weak self] opportunity in
                    self?.path.append(.messageDraft(opportunity))
                },
                onOpenSettings: { [weak self] in self?.path.append(.settings) }
            )
            .navigationDestination(for: MainRoute.self) { route in
                destination(for: route)
            }
        }
    }

    @ViewBuilder
    private func destination(for route: MainRoute) -> some View {
        switch route {
        case .opportunityList:
            OpportunityListView(
                viewModel: OpportunityListViewModel(opportunityService: container.opportunityService)
            ) { [weak self] opportunity in
                self?.path.append(.opportunityDetail(opportunity))
            }
        case .opportunityDetail(let opportunity):
            OpportunityDetailView(
                viewModel: OpportunityDetailViewModel(opportunity: opportunity)
            ) { [weak self] selected in
                self?.path.append(.messageDraft(selected))
            }
        case .contentDiscovery:
            ContentDiscoveryView(
                viewModel: ContentDiscoveryViewModel(
                    contentDiscoveryService: container.contentDiscoveryService,
                    campaignService: container.campaignService
                )
            )
        case .messageDraft(let opportunity):
            MessageDraftView(
                viewModel: MessageDraftViewModel(
                    opportunity: opportunity,
                    messageDraftService: container.messageDraftService,
                    speechSynthesisService: container.speechSynthesisService
                )
            ) { [weak self] message in
                self?.path.append(.sendConfirmation(message))
            }
        case .sendConfirmation(let message):
            SendConfirmationView(
                viewModel: SendConfirmationViewModel(message: message, emailService: container.emailService)
            ) { [weak self] sentMessage in
                self?.path.append(.sendSuccess(sentMessage))
            }
        case .sendSuccess(let message):
            SendSuccessView(message: message) { [weak self] in
                self?.path = []
            }
        case .settings:
            SettingsView(
                viewModel: SettingsViewModel(sessionManager: container.sessionManager)
            ) { [weak self] in
                self?.path.append(.voiceSettings)
            } onSignOut: { [weak self] in
                self?.onSignOut?()
            }
        case .voiceSettings:
            VoiceSettingsView(
                viewModel: VoiceSettingsViewModel(
                    sessionManager: container.sessionManager,
                    voicePreferenceService: container.voicePreferenceService,
                    speechRecognitionService: container.speechRecognitionService,
                    speechSynthesisService: container.speechSynthesisService
                )
            )
        }
    }
}
