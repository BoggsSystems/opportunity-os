import SwiftUI

enum MainTab: Hashable {
    case actions
    case dashboard
    case settings

    var title: String {
        switch self {
        case .actions: "Actions"
        case .dashboard: "Dashboard"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .actions: "sparkles.bubble"
        case .dashboard: "square.grid.2x2"
        case .settings: "gearshape"
        }
    }
}

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
    @Published var selectedTab: MainTab = .actions
    @Published var actionsPath: [MainRoute] = []
    @Published var dashboardPath: [MainRoute] = []
    @Published var settingsPath: [MainRoute] = []
    var onSignOut: (() -> Void)?

    init(container: AppContainer) {
        self.container = container
    }

    @ViewBuilder
    func view() -> some View {
        MainCoordinatorView(coordinator: self)
    }

    @ViewBuilder
    fileprivate func destination(for route: MainRoute, in section: MainTab) -> some View {
        switch route {
        case .opportunityList:
            OpportunityListView(
                viewModel: OpportunityListViewModel(opportunityService: self.container.opportunityService)
            ) { [weak self] opportunity in
                self?.append(.opportunityDetail(opportunity), to: section)
            }
        case .opportunityDetail(let opportunity):
            OpportunityDetailView(
                viewModel: OpportunityDetailViewModel(opportunity: opportunity)
            ) { [weak self] selected in
                self?.append(.messageDraft(selected), to: section)
            }
        case .contentDiscovery:
            ContentDiscoveryView(
                viewModel: ContentDiscoveryViewModel(
                    contentDiscoveryService: self.container.contentDiscoveryService,
                    campaignService: self.container.campaignService
                )
            )
        case .messageDraft(let opportunity):
            MessageDraftView(
                viewModel: MessageDraftViewModel(
                    opportunity: opportunity,
                    messageDraftService: self.container.messageDraftService,
                    speechSynthesisService: self.container.speechSynthesisService
                )
            ) { [weak self] message in
                self?.append(.sendConfirmation(message), to: section)
            }
        case .sendConfirmation(let message):
            SendConfirmationView(
                viewModel: SendConfirmationViewModel(message: message, emailService: self.container.emailService)
            ) { [weak self] sentMessage in
                self?.append(.sendSuccess(sentMessage), to: section)
            }
        case .sendSuccess(let message):
            SendSuccessView(message: message) { [weak self] in
                self?.resetPath(for: section)
            }
        case .settings:
            SettingsView(
                viewModel: SettingsViewModel(sessionManager: self.container.sessionManager)
            ) { [weak self] in
                self?.append(.voiceSettings, to: .settings)
            } onSignOut: { [weak self] in
                self?.signOut()
            }
        case .voiceSettings:
            VoiceSettingsView(
                viewModel: VoiceSettingsViewModel(
                    sessionManager: self.container.sessionManager,
                    voicePreferenceService: self.container.voicePreferenceService,
                    speechRecognitionService: self.container.speechRecognitionService,
                    speechSynthesisService: self.container.speechSynthesisService
                )
            )
        }
    }

    func openSettingsTab() {
        selectedTab = .settings
    }

    func openActionsTab() {
        selectedTab = .actions
    }

    func signOut() {
        Task {
            await self.container.authService.signOut(accessToken: self.container.sessionManager.session?.accessToken)
            self.onSignOut?()
        }
    }

    func append(_ route: MainRoute, to section: MainTab) {
        switch section {
        case .actions:
            actionsPath.append(route)
        case .dashboard:
            dashboardPath.append(route)
        case .settings:
            settingsPath.append(route)
        }
    }

    func resetPath(for section: MainTab) {
        switch section {
        case .actions:
            actionsPath = []
        case .dashboard:
            dashboardPath = []
        case .settings:
            settingsPath = []
        }
    }
}

private struct MainCoordinatorView: View {
    @ObservedObject var coordinator: MainCoordinator

    var body: some View {
        let selectedTab = Binding<MainTab>(
            get: { coordinator.selectedTab },
            set: { coordinator.selectedTab = $0 }
        )

        TabView(selection: selectedTab) {
            actionsStack
                .tabItem {
                    Label(MainTab.actions.title, systemImage: MainTab.actions.systemImage)
                }
                .tag(MainTab.actions)

            dashboardStack
                .tabItem {
                    Label(MainTab.dashboard.title, systemImage: MainTab.dashboard.systemImage)
                }
                .tag(MainTab.dashboard)

            settingsStack
                .tabItem {
                    Label(MainTab.settings.title, systemImage: MainTab.settings.systemImage)
                }
                .tag(MainTab.settings)
        }
        .onChange(of: coordinator.actionsPath) { _, newValue in
            #if DEBUG
            print("[MainCoordinatorView] actions path: \(newValue)")
            #endif
        }
        .onChange(of: coordinator.dashboardPath) { _, newValue in
            #if DEBUG
            print("[MainCoordinatorView] dashboard path: \(newValue)")
            #endif
        }
        .onChange(of: coordinator.settingsPath) { _, newValue in
            #if DEBUG
            print("[MainCoordinatorView] settings path: \(newValue)")
            #endif
        }
    }

    private var actionsStack: some View {
        NavigationStack(
            path: Binding<[MainRoute]>(
                get: { coordinator.actionsPath },
                set: { coordinator.actionsPath = $0 }
            )
        ) {
            HomeView(
                viewModel: HomeViewModel(
                    opportunityService: coordinator.container.opportunityService,
                    nextActionService: coordinator.container.nextActionService,
                    followUpService: coordinator.container.followUpService,
                    contentDiscoveryService: coordinator.container.contentDiscoveryService,
                    speechSynthesisService: coordinator.container.speechSynthesisService,
                    speechRecognitionService: coordinator.container.speechRecognitionService,
                    assistantConversationService: coordinator.container.assistantConversationService,
                    messageDraftService: coordinator.container.messageDraftService,
                    emailService: coordinator.container.emailService,
                    sessionManager: coordinator.container.sessionManager
                ),
                onOpenOpportunities: { coordinator.append(.opportunityList, to: .actions) },
                onOpenContent: { coordinator.append(.contentDiscovery, to: .actions) },
                onContinueCycle: { opportunity in
                    coordinator.append(.messageDraft(opportunity), to: .actions)
                },
                onOpenSettings: { coordinator.openSettingsTab() }
            )
            .navigationDestination(for: MainRoute.self) { route in
                coordinator.destination(for: route, in: .actions)
            }
        }
    }

    private var dashboardStack: some View {
        NavigationStack(
            path: Binding<[MainRoute]>(
                get: { coordinator.dashboardPath },
                set: { coordinator.dashboardPath = $0 }
            )
        ) {
            DashboardView(
                viewModel: DashboardViewModel(
                    opportunityService: coordinator.container.opportunityService,
                    nextActionService: coordinator.container.nextActionService,
                    followUpService: coordinator.container.followUpService,
                    contentDiscoveryService: coordinator.container.contentDiscoveryService
                ),
                onOpenActions: { coordinator.openActionsTab() },
                onOpenOpportunities: { coordinator.append(.opportunityList, to: .dashboard) },
                onOpenContent: { coordinator.append(.contentDiscovery, to: .dashboard) },
                onSelectOpportunity: { opportunity in
                    coordinator.append(.opportunityDetail(opportunity), to: .dashboard)
                }
            )
            .navigationDestination(for: MainRoute.self) { route in
                coordinator.destination(for: route, in: .dashboard)
            }
        }
    }

    private var settingsStack: some View {
        NavigationStack(
            path: Binding<[MainRoute]>(
                get: { coordinator.settingsPath },
                set: { coordinator.settingsPath = $0 }
            )
        ) {
            SettingsView(
                viewModel: SettingsViewModel(sessionManager: coordinator.container.sessionManager)
            ) {
                coordinator.append(.voiceSettings, to: .settings)
            } onSignOut: {
                coordinator.signOut()
            }
            .navigationDestination(for: MainRoute.self) { route in
                coordinator.destination(for: route, in: .settings)
            }
        }
    }
}
