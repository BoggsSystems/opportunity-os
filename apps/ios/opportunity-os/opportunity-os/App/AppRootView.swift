import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var rootCoordinator: RootCoordinator

    var body: some View {
        rootCoordinator.view()
            .tint(AppTheme.accent)
            .preferredColorScheme(.light)
    }
}

#Preview {
    AppRootView()
        .environmentObject(RootCoordinator(container: .preview))
        .environmentObject(AppContainer.preview.sessionManager)
}
