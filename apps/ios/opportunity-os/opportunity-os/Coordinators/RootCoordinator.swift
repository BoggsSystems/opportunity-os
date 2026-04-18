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

        onboardingCoordinator.onFinish = { [weak self] in
            #if DEBUG
            print("[RootCoordinator] onboarding finished; switching to main")
            #endif
            self?.routeState = .main
        }

        mainCoordinator.onSignOut = { [weak self] in
            #if DEBUG
            print("[RootCoordinator] sign out; switching to onboarding")
            #endif
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
