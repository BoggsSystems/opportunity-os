import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var currentEmail: String
    @Published var currentMode: InteractionMode

    init(sessionManager: SessionManager) {
        currentEmail = sessionManager.session?.user.email ?? PreviewData.user.email
        currentMode = sessionManager.session?.user.preferredInteractionMode ?? .voiceFirst
    }
}
