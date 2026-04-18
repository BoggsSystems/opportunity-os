import Foundation

@MainActor
struct RemoteAssistantConversationService: AssistantConversationServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func respond(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) async throws -> AssistantConversationReply {
        #if DEBUG
        print("[RemoteAssistantConversationService] POST ai/converse -> \(APIConfiguration.debugBaseURLString)")
        print("[RemoteAssistantConversationService] sessionId: \(sessionId ?? "nil"), historyCount: \(history.count), workspaceState: \(context.workspaceState)")
        print("[RemoteAssistantConversationService] message: \(message)")
        #endif
        let response: ConversationResponse = try await client.post(
            "ai/converse",
            body: ConversationRequest(
                sessionId: sessionId,
                message: message,
                history: history.map(APIConversationMessage.init),
                context: APIConversationContext(context)
            ),
            accessToken: sessionManager.session?.accessToken
        )

        #if DEBUG
        print("[RemoteAssistantConversationService] response received with sessionId: \(response.sessionId)")
        print("[RemoteAssistantConversationService] reply preview: \(response.reply.prefix(160))")
        #endif
        return AssistantConversationReply(sessionId: response.sessionId, text: response.reply)
    }

    func streamResponse(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) throws -> AsyncThrowingStream<AssistantConversationStreamChunk, Error> {
        let stream = try client.postNDJSONStream(
            "ai/converse-stream",
            body: ConversationRequest(
                sessionId: sessionId,
                message: message,
                history: history.map(APIConversationMessage.init),
                context: APIConversationContext(context)
            ),
            accessToken: sessionManager.session?.accessToken
        ) as AsyncThrowingStream<ConversationStreamEvent, Error>

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    for try await event in stream {
                        continuation.yield(event.domainChunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

private struct ConversationRequest: Encodable {
    let sessionId: String?
    let message: String
    let history: [APIConversationMessage]
    let context: APIConversationContext
}

private struct APIConversationMessage: Encodable {
    let role: String
    let text: String

    init(_ message: AssistantConversationMessage) {
        self.role = message.role.rawValue
        self.text = message.text
    }
}

private struct APIConversationContext: Encodable {
    let workspaceState: String
    let nextAction: APINextAction?
    let opportunity: APIOpportunity?
    let contentItem: APIContentItem?

    init(_ context: AssistantConversationContext) {
        self.workspaceState = context.workspaceState
        self.nextAction = context.nextAction.map(APINextAction.init)
        self.opportunity = context.opportunity.map(APIOpportunity.init)
        self.contentItem = context.contentItem.map(APIContentItem.init)
    }
}

private struct APINextAction: Encodable {
    let title: String
    let reason: String
    let recommendedAction: String

    init(_ action: NextAction) {
        self.title = action.title
        self.reason = action.reason
        self.recommendedAction = action.recommendedAction
    }
}

private struct APIOpportunity: Encodable {
    let title: String
    let companyName: String
    let summary: String

    init(_ opportunity: Opportunity) {
        self.title = opportunity.title
        self.companyName = opportunity.companyName
        self.summary = opportunity.summary
    }
}

private struct APIContentItem: Encodable {
    let title: String
    let summary: String
    let source: String

    init(_ item: ContentItem) {
        self.title = item.title
        self.summary = item.summary
        self.source = item.source
    }
}

private struct ConversationResponse: Decodable {
    let success: Bool
    let sessionId: String
    let reply: String
}

private struct ConversationStreamEvent: Decodable {
    let type: String
    let sessionId: String?
    let text: String?
    let reply: String?

    var domainChunk: AssistantConversationStreamChunk {
        let kind: AssistantConversationStreamChunk.Kind
        switch type {
        case "session":
            kind = .session
        case "chunk":
            kind = .textDelta
        default:
            kind = .done
        }

        return AssistantConversationStreamChunk(
            kind: kind,
            sessionId: sessionId,
            text: text,
            fullReply: reply
        )
    }
}
