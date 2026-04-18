import SwiftUI

@MainActor
final class RootCoordinator: ObservableObject {
    let container: AppContainer
    @Published var routeState: AppRouteState
    @Published var onboardingCoordinator: OnboardingCoordinator
    @Published var mainCoordinator: MainCoordinator

    init(container: AppContainer) {
        self.container = container
        self.routeState = container.sessionManager.isAuthenticated ? .main : .onboarding
        self.onboardingCoordinator = OnboardingCoordinator(container: container)
        self.mainCoordinator = MainCoordinator(container: container)
        debugTrace("RootCoordinator", "initialized with routeState=\(routeState)")

        onboardingCoordinator.onFinish = { [weak self] in
            debugTrace("RootCoordinator", "onboarding finished; switching to main")
            self?.routeState = .main
        }

        mainCoordinator.onSignOut = { [weak self] in
            debugTrace("RootCoordinator", "sign out requested; switching to onboarding")
            self?.container.sessionManager.clear()
            self?.routeState = .onboarding
        }
    }

    @ViewBuilder
    func view() -> some View {
        switch routeState {
        case .onboarding:
            onboardingCoordinator.view()
        case .main:
            mainCoordinator.view()
        }
    }
}
