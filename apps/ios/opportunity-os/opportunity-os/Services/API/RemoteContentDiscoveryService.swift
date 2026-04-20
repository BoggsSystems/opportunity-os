import Foundation

struct RemoteContentDiscoveryService: ContentDiscoveryServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func fetchDiscoveredContent() async -> [ContentItem] {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return []
        }

        do {
            let response: [APIContentItem] = try await client.get("discovery/content", accessToken: accessToken)
            return response.map(\.domainItem)
        } catch {
            #if DEBUG
            print("[RemoteContentDiscoveryService] fetchDiscoveredContent failed: \(error.localizedDescription)")
            #endif
            return []
        }
    }

    func uploadContent(from fileURL: URL) async throws -> ContentUploadResult {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            throw APIClientError.server(message: "No authenticated session available.")
        }

        let fileData = try Data(contentsOf: fileURL)
        let response: APIContentUploadResult = try await client.postMultipart(
            "discovery/content/upload",
            fields: [
                "title": fileURL.deletingPathExtension().lastPathComponent,
                "source": fileURL.lastPathComponent
            ],
            fileFieldName: "file",
            fileName: fileURL.lastPathComponent,
            mimeType: "application/pdf",
            fileData: fileData,
            accessToken: accessToken
        )

        return response.domainResult
    }

    func executeContent(itemId: UUID, maxTargets: Int) async throws -> ContentExecutionResult {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            throw APIClientError.server(message: "No authenticated session available.")
        }

        let response: APIContentExecutionResult = try await client.post(
            "discovery/content/\(itemId.uuidString.lowercased())/execute",
            body: ExecuteContentRequest(maxTargets: maxTargets),
            accessToken: accessToken
        )

        return response.domainResult
    }
}

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
            let response: [APICampaign] = try await client.get("campaigns", accessToken: accessToken)
            return response.map { $0.toDomain() }
        } catch {
            #if DEBUG
            print("[RemoteCampaignService] fetchCampaigns failed: \(error.localizedDescription)")
            #endif
            return []
        }
    }
}

private struct APICampaign: Decodable {
    let id: String
    let goalId: String
    let title: String
    let strategicAngle: String?
    let targetSegment: String?
    let status: String
    let assetIds: [String]?
    
    func toDomain() -> Campaign {
        Campaign(
            id: UUID(uuidString: id) ?? UUID(),
            goalId: UUID(uuidString: goalId) ?? UUID(),
            title: title,
            strategicAngle: strategicAngle,
            targetSegment: targetSegment,
            status: mapStatus(status),
            assetIds: assetIds?.compactMap { UUID(uuidString: $0) }
        )
    }
    
    private func mapStatus(_ value: String) -> CampaignStatus {
        switch value.lowercased() {
        case "active": return .active
        case "paused": return .paused
        case "completed": return .completed
        default: return .planning
        }
    }
}

private struct APIContentItem: Decodable {
    let id: String
    let title: String
    let source: String
    let summary: String
    let linkedOfferingName: String?
    let campaignPotential: String
    let lifecycleStatus: String?
    let fitScore: Int?
    let priorityScore: Int?
}

private extension APIContentItem {
    var domainItem: ContentItem {
        ContentItem(
            id: UUID(uuidString: id) ?? UUID(),
            title: title,
            source: source,
            summary: summary,
            linkedOfferingName: linkedOfferingName,
            campaignPotential: campaignPotential,
            lifecycleStatus: lifecycleStatus,
            fitScore: fitScore,
            priorityScore: priorityScore
        )
    }
}

private struct APIContentUploadResult: Decodable {
    let discoveredItemId: String?
    let contentOpportunityId: String?
    let title: String
    let source: String?
    let summary: String?
    let processingStatus: String
}

private extension APIContentUploadResult {
    var domainResult: ContentUploadResult {
        ContentUploadResult(
            discoveredItemId: discoveredItemId.flatMap(UUID.init(uuidString:)),
            contentOpportunityId: contentOpportunityId.flatMap(UUID.init(uuidString:)),
            title: title,
            source: source,
            summary: summary,
            processingStatus: processingStatus
        )
    }
}

private struct ExecuteContentRequest: Encodable {
    let maxTargets: Int
}

private struct APIContentExecutionResult: Decodable {
    let contentOpportunityId: String?
    let discoveredItemId: String?
    let targetCount: Int
    let targets: [APIExecutedTarget]
}

private struct APIExecutedTarget: Decodable {
    let personId: String
    let fullName: String
    let companyId: String
    let companyName: String
    let opportunityId: String
    let taskId: String
    let activityId: String
    let reasonForOutreach: String
    let suggestedAngle: String
}

private extension APIContentExecutionResult {
    var domainResult: ContentExecutionResult {
        ContentExecutionResult(
            contentOpportunityId: contentOpportunityId.flatMap(UUID.init(uuidString:)),
            discoveredItemId: discoveredItemId.flatMap(UUID.init(uuidString:)),
            targetCount: targetCount,
            targets: targets.map(\.domainTarget)
        )
    }
}

private extension APIExecutedTarget {
    var domainTarget: ExecutedTarget {
        ExecutedTarget(
            id: UUID(uuidString: personId) ?? UUID(),
            fullName: fullName,
            companyName: companyName,
            reasonForOutreach: reasonForOutreach,
            suggestedAngle: suggestedAngle,
            opportunityId: UUID(uuidString: opportunityId) ?? UUID()
        )
    }
}
