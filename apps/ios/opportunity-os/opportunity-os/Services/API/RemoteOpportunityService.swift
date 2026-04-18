import Foundation

struct RemoteOpportunityService: OpportunityServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func fetchRecommendedOpportunities() async -> [Opportunity] {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return []
        }

        do {
            let response: [APIOpportunity] = try await client.get("opportunities", accessToken: accessToken)
            return response.map(\.domainOpportunity)
        } catch {
            #if DEBUG
            print("[RemoteOpportunityService] fetchRecommendedOpportunities failed: \(error.localizedDescription)")
            #endif
            return []
        }
    }

    func fetchOpportunity(id: UUID) async -> Opportunity? {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return nil
        }

        do {
            let response: APIOpportunity = try await client.get("opportunities/\(id.uuidString)", accessToken: accessToken)
            return response.domainOpportunity
        } catch {
            #if DEBUG
            print("[RemoteOpportunityService] fetchOpportunity failed: \(error.localizedDescription)")
            #endif
            return nil
        }
    }
}

private struct APIOpportunity: Decodable {
    let id: String
    let title: String
    let companyName: String?
    let summary: String?
    let opportunityType: String?
    let source: String?
    let stage: String?
    let fitScore: Int?
}

private extension APIOpportunity {
    var domainOpportunity: Opportunity {
        Opportunity(
            id: UUID(uuidString: id) ?? UUID(),
            title: title,
            companyName: companyName ?? "Untitled Company",
            summary: summary ?? "No summary yet for this opportunity.",
            type: mapOpportunityType(opportunityType),
            source: mapOpportunitySource(source),
            cycleStatus: mapCycleStatus(stage),
            momentumScore: fitScore ?? 50,
            recipients: []
        )
    }

    func mapOpportunityType(_ value: String?) -> OpportunityType {
        switch value {
        case "consulting":
            return .partnership
        case "contract":
            return .followUp
        case "networking":
            return .outreach
        case "job":
            return .outreach
        default:
            return .contentDriven
        }
    }

    func mapOpportunitySource(_ value: String?) -> OpportunitySource {
        switch value?.lowercased() {
        case "scan":
            return .scan
        case "campaign":
            return .campaign
        case "manual":
            return .manual
        default:
            return .aiDiscovery
        }
    }

    func mapCycleStatus(_ value: String?) -> CycleStatus {
        switch value {
        case "closed_won":
            return .completed
        case "closed_lost":
            return .completed
        case "conversation_started", "interviewing":
            return .inProgress
        case "outreach_sent", "applied", "awaiting_decision":
            return .waiting
        case "targeted":
            return .ready
        default:
            return .idle
        }
    }
}
