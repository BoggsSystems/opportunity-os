import SwiftUI

@main
struct OpportunityOSApp: App {
    @StateObject private var rootCoordinator = RootCoordinator(container: AppContainer.preview)

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(rootCoordinator)
                .environmentObject(rootCoordinator.container.sessionManager)
        }
    }
}
