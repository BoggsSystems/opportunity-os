import Foundation

protocol GoalServiceProtocol {
    func fetchActiveGoal() async -> Goal?
}

struct RemoteGoalService: GoalServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func fetchActiveGoal() async -> Goal? {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return nil
        }

        do {
            let response: [APIGoalResponse] = try await client.get("goals", accessToken: accessToken)
            // For now, take the first active or latest goal
            guard let latest = response.first else { return nil }
            
            return Goal(
                id: UUID(uuidString: latest.id) ?? UUID(),
                title: latest.title,
                description: latest.description,
                targetDate: nil, // API might not return this yet
                status: mapStatus(latest.status),
                campaigns: nil // We fetch these separately or ignore for now
            )
        } catch {
            #if DEBUG
            print("[RemoteGoalService] fetchActiveGoal failed: \(error.localizedDescription)")
            #endif
            return nil
        }
    }
    
    private func mapStatus(_ value: String?) -> GoalStatus {
        switch value?.lowercased() {
        case "active": return .active
        case "completed": return .completed
        case "archived": return .archived
        default: return .active
        }
    }
}

private struct APIGoalResponse: Decodable {
    let id: String
    let title: String
    let description: String?
    let status: String?
}
