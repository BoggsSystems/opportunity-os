import Foundation

// MARK: - Request/Response

struct CreateActivityRequest: Codable {
    let activityType: String
    let channel: String?
    let direction: String?
    let subject: String?
    let bodySummary: String?
    let occurredAt: String
    let outcome: String?
    let opportunityId: String?
    let companyId: String?
}

// MARK: - Remote Implementation

final class RemoteActivityService: ActivityServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func logEmailSent(opportunityId: String?, companyId: String?, subject: String, bodySummary: String) async throws {
        guard await sessionManager.isAuthenticated else {
            // Silently skip for guests — no user record to attach it to
            return
        }

        let formatter = ISO8601DateFormatter()
        let body = CreateActivityRequest(
            activityType: "email",
            channel: "email",
            direction: "outbound",
            subject: subject,
            bodySummary: bodySummary,
            occurredAt: formatter.string(from: Date()),
            outcome: "sent",
            opportunityId: opportunityId,
            companyId: companyId
        )

        let _: EmptyResponse = try await client.post("activities", body: body)
    }
}

// MARK: - No-op stub for previews / guests

final class StubActivityService: ActivityServiceProtocol {
    func logEmailSent(opportunityId: String?, companyId: String?, subject: String, bodySummary: String) async throws {}
}

private struct EmptyResponse: Decodable {}
