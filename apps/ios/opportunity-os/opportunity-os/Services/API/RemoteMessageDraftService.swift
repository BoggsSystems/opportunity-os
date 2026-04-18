import Foundation

struct RemoteMessageDraftService: MessageDraftServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func generateDraft(for opportunity: Opportunity) async -> OutreachMessage {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            return fallbackDraft(for: opportunity)
        }

        do {
            let response: APIDraftResponse = try await client.get("outreach/draft/\(opportunity.id.uuidString)", accessToken: accessToken)
            return response.domainDraft
        } catch {
            #if DEBUG
            print("[RemoteMessageDraftService] generateDraft failed: \(error.localizedDescription)")
            #endif
            return fallbackDraft(for: opportunity)
        }
    }

    private func fallbackDraft(for opportunity: Opportunity) -> OutreachMessage {
        OutreachMessage(
            id: UUID(),
            subject: "Idea sparked by \(opportunity.title)",
            body: """
            Hi,

            I came across an opportunity to connect around \(opportunity.title.lowercased()).
            I think there may be a useful angle here around \(opportunity.summary.lowercased()).

            Open to a short conversation?
            """,
            recipients: opportunity.recipients,
            approvalRequired: true
        )
    }
}

private struct APIDraftResponse: Decodable {
    let id: String
    let subject: String
    let body: String
    let recipients: [APIDraftRecipient]
    let approvalRequired: Bool
}

private extension APIDraftResponse {
    var domainDraft: OutreachMessage {
        OutreachMessage(
            id: UUID(uuidString: id) ?? UUID(),
            subject: subject,
            body: body,
            recipients: recipients.map(\.domainRecipient),
            approvalRequired: approvalRequired
        )
    }
}

private struct APIDraftRecipient: Decodable {
    let id: String
    let name: String
    let organization: String
    let email: String?
    let role: String
}

private extension APIDraftRecipient {
    var domainRecipient: Recipient {
        Recipient(
            id: UUID(uuidString: id) ?? UUID(),
            name: name,
            organization: organization,
            email: email,
            role: role
        )
    }
}
