import Foundation

struct RemoteEmailService: EmailServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func send(_ message: OutreachMessage) async throws {
        guard let accessToken = await MainActor.run(body: { sessionManager.session?.accessToken }) else {
            throw APIClientError.server(message: "No authenticated session available.")
        }

        let _: SendDraftResponse = try await client.post(
            "outreach/send",
            body: SendDraftRequest(
                subject: message.subject,
                body: message.body,
                recipients: message.recipients.map {
                    SendDraftRecipient(
                        name: $0.name,
                        organization: $0.organization,
                        email: $0.email,
                        role: $0.role
                    )
                }
            ),
            accessToken: accessToken
        )
    }
}

private struct SendDraftRequest: Encodable {
    let subject: String
    let body: String
    let recipients: [SendDraftRecipient]
}

private struct SendDraftRecipient: Encodable {
    let name: String
    let organization: String
    let email: String?
    let role: String
}

private struct SendDraftResponse: Decodable {
    let success: Bool
    let sentAt: String
}
