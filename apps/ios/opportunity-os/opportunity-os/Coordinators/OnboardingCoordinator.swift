import SwiftUI

enum OnboardingRoute: Hashable {
    case welcome
    case goalDiscovery
    case emailEntry(mode: AuthEntryMode, plan: OnboardingPlan?)
    case passwordEntry(email: String, mode: AuthEntryMode, plan: OnboardingPlan?)
    case voiceModeSetup(plan: OnboardingPlan?)
    case firstCycleLaunch(plan: OnboardingPlan)
}

private enum DebugAuthDefaults {
    static let email = "jeff@example.com"
    static let password = "supersecret123"
}

@MainActor
final class OnboardingCoordinator: ObservableObject {
    let container: AppContainer
    @Published var path: [OnboardingRoute] = []
    var onFinish: (() -> Void)?

    init(container: AppContainer) {
        self.container = container
    }

    @ViewBuilder
    func view() -> some View {
        OnboardingCoordinatorView(coordinator: self)
    }

    @ViewBuilder
    fileprivate func destination(for route: OnboardingRoute) -> some View {
        switch route {
        case .welcome:
            WelcomeView(
                viewModel: WelcomeViewModel(
                    speechSynthesisService: self.container.speechSynthesisService
                )
            ) {
                self.debugLog("Get Started tapped")
                self.container.sessionManager.markWelcomeSeen()
                self.path.append(.goalDiscovery)
                self.debugLog("Path after welcome tap: \(self.path)")
            } onUseTestAccount: {
                self.debugLog("Use Test Account tapped")
                self.container.sessionManager.markWelcomeSeen()
                self.path.append(.emailEntry(mode: .signIn, plan: nil))
                self.debugLog("Path after test account tap: \(self.path)")
            }
        case .goalDiscovery:
            GoalDiscoveryView(
                viewModel: GoalDiscoveryViewModel(
                    assistantConversationService: self.container.assistantConversationService,
                    speechRecognitionService: self.container.speechRecognitionService,
                    speechSynthesisService: self.container.speechSynthesisService,
                    emailService: self.container.emailService,
                    sessionManager: self.container.sessionManager
                )
            ) { plan in
                self.debugLog("Goal discovery produced plan: \(plan.firstCycleTitle)")
                self.path.append(.emailEntry(mode: .signUp, plan: plan))
                self.debugLog("Path after goal discovery: \(self.path)")
            }
        case .emailEntry(let mode, let plan):
            EmailEntryView(
                viewModel: EmailEntryViewModel(
                    mode: mode,
                    speechRecognitionService: self.container.speechRecognitionService,
                    speechSynthesisService: self.container.speechSynthesisService,
                    initialEmail: mode == .signIn ? (self.container.sessionManager.lastSignedInEmail ?? DebugAuthDefaults.email) : nil
                ),
                onboardingPlan: plan
            ) { email in
                self.debugLog("Email submitted: \(email)")
                self.path.append(.passwordEntry(email: email, mode: mode, plan: plan))
                self.debugLog("Path after email entry: \(self.path)")
            }
        case .passwordEntry(let email, let mode, let plan):
            PasswordEntryView(
                viewModel: PasswordEntryViewModel(
                    email: email,
                    mode: mode,
                    authService: self.container.authService,
                    sessionManager: self.container.sessionManager,
                    speechRecognitionService: self.container.speechRecognitionService,
                    speechSynthesisService: self.container.speechSynthesisService,
                    initialPassword: mode == .signIn ? DebugAuthDefaults.password : nil
                ),
                onboardingPlan: plan
            ) {
                self.debugLog("\(mode.rawValue) accepted for \(email)")
                self.path.append(.voiceModeSetup(plan: mode == .signUp ? plan : nil))
                self.debugLog("Path after password entry: \(self.path)")
            }
        case .voiceModeSetup(let plan):
            VoiceModeSetupView(
                viewModel: VoiceModeSetupViewModel(
                    sessionManager: self.container.sessionManager,
                    voicePreferenceService: self.container.voicePreferenceService,
                    speechSynthesisService: self.container.speechSynthesisService,
                    speechRecognitionService: self.container.speechRecognitionService
                ),
                onboardingPlan: plan
            ) {
                self.debugLog("Voice setup finished")
                if let plan {
                    self.path.append(.firstCycleLaunch(plan: plan))
                    self.debugLog("Path after voice setup: \(self.path)")
                } else {
                    self.onFinish?()
                }
            }
        case .firstCycleLaunch(let plan):
            FirstCycleLaunchView(plan: plan) {
                self.debugLog("First cycle launch finished")
                self.onFinish?()
            }
        }
    }

    private func debugLog(_ message: String) {
        #if DEBUG
        print("[OnboardingCoordinator] \(message)")
        #endif
    }
}

private struct OnboardingCoordinatorView: View {
    @ObservedObject var coordinator: OnboardingCoordinator

    var body: some View {
        let navigationPath = Binding<[OnboardingRoute]>(
            get: { coordinator.path },
            set: { coordinator.path = $0 }
        )

        NavigationStack(path: navigationPath) {
            coordinator.destination(
                for: coordinator.container.sessionManager.shouldShowWelcome ? .welcome : .emailEntry(mode: .signIn, plan: nil)
            )
                .navigationDestination(for: OnboardingRoute.self) { route in
                    coordinator.destination(for: route)
                }
        }
        .onChange(of: coordinator.path) { _, newValue in
            #if DEBUG
            print("[OnboardingCoordinatorView] rendered path: \(newValue)")
            #endif
        }
    }
}
