import Foundation

struct RemoteStrategyService: StrategyServiceProtocol {
    private let apiClient: OpportunityOSAPIClient
    private let sessionManager: SessionManager
    
    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.apiClient = client
        self.sessionManager = sessionManager
    }
    
    func finalizeStrategicGoal(sessionId: String) async throws -> StrategicResult {
        let (accessToken, guestSessionId) = await MainActor.run {
            (sessionManager.session?.accessToken, sessionManager.guestSessionId)
        }
        
        struct RequestBody: Codable {
            let sessionId: String
            let guestSessionId: String?
        }
        
        let body = RequestBody(sessionId: sessionId, guestSessionId: guestSessionId)
        
        do {
            let response: StrategicResult = try await apiClient.post(
                "ai/finalize-strategic-goal",
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
    
    func previewStrategicPlan(sessionId: String) async throws -> StrategicResult {
        let (accessToken, guestSessionId) = await MainActor.run {
            (sessionManager.session?.accessToken, sessionManager.guestSessionId)
        }
        
        struct RequestBody: Codable {
            let sessionId: String
            let guestSessionId: String?
        }
        
        let body = RequestBody(sessionId: sessionId, guestSessionId: guestSessionId)
        
        do {
            let response: StrategicResult = try await apiClient.post(
                "ai/preview-strategic-plan",
                body: body,
                accessToken: accessToken
            )
            return response
        } catch {
            throw OnboardingError.serverError(error.localizedDescription)
        }
    }
}
