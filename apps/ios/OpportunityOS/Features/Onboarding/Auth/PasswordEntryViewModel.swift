import Foundation

@MainActor
final class PasswordEntryViewModel: ObservableObject {
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    let email: String
    private let authService: AuthServiceProtocol
    private let sessionManager: SessionManager

    init(email: String, authService: AuthServiceProtocol, sessionManager: SessionManager) {
        self.email = email
        self.authService = authService
        self.sessionManager = sessionManager
    }

    func signIn() async -> Bool {
        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await authService.signIn(email: email, password: password)
            sessionManager.start(session: session)
            return true
        } catch {
            errorMessage = "Unable to sign in."
            return false
        }
    }
}
