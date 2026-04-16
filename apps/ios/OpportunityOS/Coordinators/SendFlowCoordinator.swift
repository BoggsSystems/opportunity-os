import SwiftUI

enum SendFlowRoute: Hashable {
    case confirmation(OutreachMessage)
    case success(OutreachMessage)
}

@MainActor
final class SendFlowCoordinator: ObservableObject {
    @Published var path: [SendFlowRoute] = []

    @ViewBuilder
    func view(
        confirmationView: some View,
        destination: @escaping (SendFlowRoute) -> AnyView
    ) -> some View {
        NavigationStack(path: $path) {
            confirmationView
                .navigationDestination(for: SendFlowRoute.self) { route in
                    destination(route)
                }
        }
    }
}
