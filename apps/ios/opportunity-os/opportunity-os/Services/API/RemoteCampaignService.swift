import Foundation

struct RemoteCampaignService: CampaignServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func fetchCampaigns() async -> [Campaign] {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return []
        }

        do {
            // Note: Currently fetching all goals and flattening campaigns as a proxy 
            // since we don't have a direct campaigns endpoint exposed in the same way.
            let response: [APIGoal] = try await client.get("goals", accessToken: accessToken)
            let campaigns = response.flatMap { goal in
                (goal.campaigns ?? []).map { apiCampaign in
                    apiCampaign.toDomain(goalId: UUID(uuidString: goal.id) ?? UUID())
                }
            }
            return campaigns
        } catch {
            #if DEBUG
            print("[RemoteCampaignService] fetchCampaigns failed: \(error.localizedDescription)")
            #endif
            return []
        }
    }
}

private struct APIGoal: Decodable {
    let id: String
    let campaigns: [APICampaign]?
}

private struct APICampaign: Decodable {
    let id: String
    let title: String
    let strategicAngle: String?
    let targetSegment: String?
    let status: String?
    let assetIds: [String]?
    
    func toDomain(goalId: UUID) -> Campaign {
        Campaign(
            id: UUID(uuidString: id) ?? UUID(),
            goalId: goalId,
            title: title,
            strategicAngle: strategicAngle,
            targetSegment: targetSegment,
            status: mapStatus(status),
            assetIds: assetIds?.compactMap { UUID(uuidString: $0) }
        )
    }
    
    private func mapStatus(_ value: String?) -> CampaignStatus {
        switch value?.lowercased() {
        case "active": return .active
        case "planning": return .planning
        case "paused": return .paused
        case "completed": return .completed
        default: return .planning
        }
    }
}
