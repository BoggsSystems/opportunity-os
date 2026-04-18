import Foundation

struct RemoteNextActionService: NextActionServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func fetchTopNextAction() async -> NextAction? {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return nil
        }

        do {
            let response: [APINextAction] = try await client.get("next-actions", accessToken: accessToken)
            return response.first?.domainNextAction
        } catch {
            #if DEBUG
            print("[RemoteNextActionService] fetchTopNextAction failed: \(error.localizedDescription)")
            #endif
            return nil
        }
    }
}

private struct APINextAction: Decodable {
    let title: String
    let reason: String
    let recommendedAction: String
    let opportunityId: String?
}

private extension APINextAction {
    var domainNextAction: NextAction {
        NextAction(
            title: title,
            reason: reason,
            recommendedAction: recommendedAction,
            opportunityId: opportunityId.flatMap(UUID.init(uuidString:))
        )
    }
}
