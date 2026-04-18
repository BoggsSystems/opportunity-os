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
        let navigationPath = Binding(
            get: { self.path },
            set: { self.path = $0 }
        )

        NavigationStack(path: navigationPath) {
            confirmationView
                .navigationDestination(for: SendFlowRoute.self) { route in
                    destination(route)
                }
        }
    }
}
