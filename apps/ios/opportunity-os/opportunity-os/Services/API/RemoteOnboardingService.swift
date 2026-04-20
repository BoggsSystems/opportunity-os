import Foundation

struct RemoteOnboardingService: OnboardingServiceProtocol {
    private let apiClient: OpportunityOSAPIClient
    private let sessionManager: SessionManager
    
    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.apiClient = client
        self.sessionManager = sessionManager
    }
    
    func finalizeOnboarding(sessionId: String) async throws -> OnboardingResult {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            throw OnboardingError.noSessionId
        }
        
        struct RequestBody: Codable {
            let sessionId: String
        }
        
        let body = RequestBody(sessionId: sessionId)
        
        do {
            let response: OnboardingResult = try await apiClient.post(
                "ai/finalize-onboarding",
                body: body,
                accessToken: accessToken
            )
            return response
        } catch let error as APIClientError {
            throw OnboardingError.serverError(error.localizedDescription)
        } catch {
            throw OnboardingError.serverError(error.localizedDescription)
        }
    }
}
