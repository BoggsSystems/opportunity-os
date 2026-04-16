import SwiftUI

enum OnboardingRoute: Hashable {
    case welcome
    case emailEntry
    case passwordEntry(email: String)
    case voiceModeSetup
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
        NavigationStack(path: $path) {
            let viewModel = WelcomeViewModel(
                speechSynthesisService: container.speechSynthesisService
            )
            WelcomeView(viewModel: viewModel) { [weak self] in
                self?.path.append(.emailEntry)
            }
            .navigationDestination(for: OnboardingRoute.self) { route in
                destination(for: route)
            }
        }
    }

    @ViewBuilder
    private func destination(for route: OnboardingRoute) -> some View {
        switch route {
        case .welcome:
            EmptyView()
        case .emailEntry:
            EmailEntryView(
                viewModel: EmailEntryViewModel()
            ) { [weak self] email in
                self?.path.append(.passwordEntry(email: email))
            }
        case .passwordEntry(let email):
            PasswordEntryView(
                viewModel: PasswordEntryViewModel(email: email, authService: container.authService, sessionManager: container.sessionManager)
            ) { [weak self] in
                self?.path.append(.voiceModeSetup)
            }
        case .voiceModeSetup:
            VoiceModeSetupView(
                viewModel: VoiceModeSetupViewModel(
                    sessionManager: container.sessionManager,
                    voicePreferenceService: container.voicePreferenceService,
                    speechSynthesisService: container.speechSynthesisService
                )
            ) { [weak self] in
                self?.onFinish?()
            }
        }
    }
}
