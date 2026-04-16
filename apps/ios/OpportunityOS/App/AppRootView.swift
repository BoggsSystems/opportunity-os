import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var rootCoordinator: RootCoordinator

    var body: some View {
        rootCoordinator.view()
            .preferredColorScheme(.dark)
    }
}

#Preview {
    AppRootView()
        .environmentObject(RootCoordinator(container: .preview))
        .environmentObject(AppContainer.preview.sessionManager)
}
