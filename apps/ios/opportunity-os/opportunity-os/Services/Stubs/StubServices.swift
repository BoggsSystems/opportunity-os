import Foundation

struct StubAuthService: AuthServiceProtocol {
    func signUp(email: String, password: String) async throws -> AuthSession {
        let user = User(
            id: UUID(),
            firstName: "New",
            lastName: "User",
            email: email,
            preferredInteractionMode: .voiceFirst
        )
        return AuthSession(
            accessToken: "preview-signup-token",
            refreshToken: "preview-signup-refresh-token",
            sessionId: UUID().uuidString,
            user: user,
            startedAt: Date()
        )
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        // TODO: Replace with real API-backed authentication.
        let user = User(
            id: UUID(),
            firstName: "Jeff",
            lastName: "Boggs",
            email: email,
            preferredInteractionMode: .voiceFirst
        )
        return AuthSession(
            accessToken: "preview-token",
            refreshToken: "preview-refresh-token",
            sessionId: UUID().uuidString,
            user: user,
            startedAt: Date()
        )
    }

    func signOut(accessToken: String?) async {}
}

actor StubSpeechRecognitionTurnStore {
    private var turns: [String]
    private var currentIndex = 0

    init(seedInput: String?) {
        if let seedInput,
           let data = seedInput.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data),
           !decoded.isEmpty {
            self.turns = decoded
        } else {
            self.turns = ["Switch to a British female voice."]
        }
    }

    func nextTurn() -> String {
        guard !turns.isEmpty else {
            return ""
        }

        let index = min(currentIndex, turns.count - 1)
        let turn = turns[index]
        if currentIndex < turns.count - 1 {
            currentIndex += 1
        }
        return turn
    }
}

final class StubSpeechRecognitionService: SpeechRecognitionServiceProtocol {
    var onSpeechDetected: (() -> Void)? = nil
    var activeSynthesizedText: String? = nil
    private let turnStore: StubSpeechRecognitionTurnStore
    private var transcript = ""

    init(seedInput: String? = nil) {
        self.turnStore = StubSpeechRecognitionTurnStore(seedInput: seedInput)
    }

    func startListening() async throws {
        // TODO: Integrate Speech framework / transcription pipeline.
    }

    func stopListening() async {}

    func latestTranscript() async -> String {
        transcript
    }

    func listenForUtterance() async throws -> String {
        try await startListening()
        transcript = await turnStore.nextTurn()
        #if DEBUG
        print("[StubSpeechRecognitionService] returning scripted turn: \(transcript)")
        #endif
        return transcript
    }
}

struct StubSpeechSynthesisService: SpeechSynthesisServiceProtocol {
    func speak(_ text: String, preference: VoicePreference) async {
        // TODO: Integrate AVSpeechSynthesizer or server-side voice output.
        print("Speaking with \(preference.displayName): \(text)")
    }

    func enqueueSpeech(_ text: String, preference: VoicePreference) async {
        print("Queued speech with \(preference.displayName): \(text)")
    }

    func waitForSpeechQueue() async {}

    func stopSpeaking() async {}
}

actor StubVoicePreferenceStore {
    private var preference = PreviewData.voicePreference

    func load() -> VoicePreference { preference }
    func save(_ value: VoicePreference) { preference = value }
}

struct StubVoicePreferenceService: VoicePreferenceServiceProtocol {
    private let store = StubVoicePreferenceStore()

    func loadPreference() async -> VoicePreference {
        await store.load()
    }

    func savePreference(_ preference: VoicePreference) async {
        await store.save(preference)
    }

    func parseNaturalLanguageVoiceRequest(_ request: String, current: VoicePreference) async -> VoicePreference {
        var updated = current
        let lowercased = request.lowercased()
        if lowercased.contains("british") {
            updated.localeIdentifier = "en-GB"
        }
        if lowercased.contains("female") {
            updated.displayName = "Avery"
        }
        updated.styleDescription = request
        return updated
    }
}

struct StubAssistantConversationService: AssistantConversationServiceProtocol {
    func respond(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) async throws -> AssistantConversationReply {
        let lowered = message.lowercased()

        if lowered.contains("why") {
            return AssistantConversationReply(
                sessionId: sessionId ?? UUID().uuidString,
                text: context.nextAction?.reason ?? "This is the best available move based on the current outreach and discovery context.",
                shouldBeSilent: false
            )
        }

        if lowered.contains("wait") || lowered.contains("shh") || lowered.contains("quiet") {
            return AssistantConversationReply(
                sessionId: sessionId ?? UUID().uuidString,
                text: "",
                shouldBeSilent: true
            )
        }

        if lowered.contains("next") || lowered.contains("what should i do") {
            if let title = context.nextAction?.title {
                return AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "The next move is \(title).", shouldBeSilent: false)
            }
            return AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "The next move is to import content or scan for opportunities.", shouldBeSilent: false)
        }

        if lowered.contains("call") {
            return AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "I’m ready to support a pre-call brief, live call handoff, and post-call debrief here once that workflow is active.", shouldBeSilent: false)
        }

        if lowered.contains("draft") {
            return AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "I can prepare the draft in this workspace so you stay in the assistant flow.", shouldBeSilent: false)
        }

        return AssistantConversationReply(
            sessionId: sessionId ?? UUID().uuidString,
            text: history.last(where: { $0.role == .assistant })?.text
                ?? "I’m staying with you here. We can keep talking through the next move one turn at a time.",
            shouldBeSilent: false
        )
    }

    func streamResponse(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) throws -> AsyncThrowingStream<AssistantConversationStreamChunk, Error> {
        let lowered = message.lowercased()
        let resolvedReply: AssistantConversationReply

        if lowered.contains("why") {
            resolvedReply = AssistantConversationReply(
                sessionId: sessionId ?? UUID().uuidString,
                text: context.nextAction?.reason ?? "This is the best available move based on the current outreach and discovery context.",
                shouldBeSilent: false
            )
        } else if lowered.contains("wait") || lowered.contains("shh") || lowered.contains("quiet") {
            resolvedReply = AssistantConversationReply(
                sessionId: sessionId ?? UUID().uuidString,
                text: "",
                shouldBeSilent: true
            )
        } else if lowered.contains("next") || lowered.contains("what should i do") {
            if let title = context.nextAction?.title {
                resolvedReply = AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "The next move is \(title).", shouldBeSilent: false)
            } else {
                resolvedReply = AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "The next move is to import content or scan for opportunities.", shouldBeSilent: false)
            }
        } else if lowered.contains("call") {
            resolvedReply = AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "I’m ready to support a pre-call brief, live call handoff, and post-call debrief here once that workflow is active.", shouldBeSilent: false)
        } else if lowered.contains("draft") {
            resolvedReply = AssistantConversationReply(sessionId: sessionId ?? UUID().uuidString, text: "I can prepare the draft in this workspace so you stay in the assistant flow.", shouldBeSilent: false)
        } else {
            resolvedReply = AssistantConversationReply(
                sessionId: sessionId ?? UUID().uuidString,
                text: history.last(where: { $0.role == .assistant })?.text
                    ?? "I’m staying with you here. We can keep talking through the next move one turn at a time.",
                shouldBeSilent: false
            )
        }

        return AsyncThrowingStream { continuation in
            continuation.yield(
                AssistantConversationStreamChunk(
                    kind: .session,
                    sessionId: resolvedReply.sessionId,
                    text: nil,
                    fullReply: nil
                )
            )

            Task {
                let words = resolvedReply.text.split(separator: " ")
                for word in words {
                    continuation.yield(
                        AssistantConversationStreamChunk(
                            kind: .textDelta,
                            sessionId: resolvedReply.sessionId,
                            text: String(word) + " ",
                            fullReply: nil
                        )
                    )
                    try? await Task.sleep(for: .milliseconds(60))
                }

                continuation.yield(
                    AssistantConversationStreamChunk(
                        kind: .done,
                        sessionId: resolvedReply.sessionId,
                        text: nil,
                        fullReply: resolvedReply.text,
                        shouldBeSilent: resolvedReply.shouldBeSilent
                    )
                )
                continuation.finish()
            }
        }
    }
}

struct StubOpportunityService: OpportunityServiceProtocol {
    func fetchRecommendedOpportunities() async -> [Opportunity] {
        PreviewData.opportunities
    }

    func fetchOpportunity(id: UUID) async -> Opportunity? {
        PreviewData.opportunities.first(where: { $0.id == id })
    }
}

struct StubNextActionService: NextActionServiceProtocol {
    func fetchTopNextAction() async -> NextAction? {
        NextAction(
            title: "Next Recommended Action",
            reason: PreviewData.opportunities.first?.summary ?? "Move the cycle forward with a draft.",
            recommendedAction: "Draft Outreach",
            opportunityId: PreviewData.opportunities.first?.id
        )
    }
}

struct StubOpportunityScanService: OpportunityScanServiceProtocol {
    func runScan() async -> [ScanResult] {
        [
            ScanResult(
                id: UUID(),
                title: "New report-based outreach angle",
                summary: "A high-credibility content item can anchor a new outbound sequence.",
                source: .aiDiscovery,
                suggestedAction: "Turn it into a campaign theme."
            )
        ]
    }
}

struct StubFollowUpService: FollowUpServiceProtocol {
    func fetchFollowUps() async -> [FollowUpItem] {
        [
            FollowUpItem(
                id: UUID(),
                title: "Follow up on prior audit note",
                reason: "Momentum is cooling after the first touch.",
                dueDate: Date().addingTimeInterval(86_400),
                recipient: PreviewData.recipients[1]
            )
        ]
    }
}

struct StubMessageDraftService: MessageDraftServiceProtocol {
    func generateDraft(for opportunity: Opportunity) async -> OutreachMessage {
        // TODO: Replace with API-backed drafting using the backend AI layer.
        return OutreachMessage(
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

struct StubEmailService: EmailServiceProtocol {
    func send(_ message: OutreachMessage) async throws {
        // TODO: Replace with real send/approval flow.
        try await Task.sleep(for: .milliseconds(300))
    }
}

struct StubCampaignService: CampaignServiceProtocol {
    func fetchCampaigns() async -> [Campaign] {
        PreviewData.campaigns
    }
}

struct StubContentDiscoveryService: ContentDiscoveryServiceProtocol {
    func fetchDiscoveredContent() async -> [ContentItem] {
        PreviewData.contentItems
    }

    func uploadContent(from fileURL: URL) async throws -> ContentUploadResult {
        ContentUploadResult(
            discoveredItemId: UUID(),
            contentOpportunityId: UUID(),
            title: fileURL.deletingPathExtension().lastPathComponent,
            source: fileURL.lastPathComponent,
            summary: "Preview upload completed.",
            processingStatus: "classified"
        )
    }

    func executeContent(itemId: UUID, maxTargets: Int) async throws -> ContentExecutionResult {
        ContentExecutionResult(
            contentOpportunityId: itemId,
            discoveredItemId: itemId,
            targetCount: 1,
            targets: [
                ExecutedTarget(
                    id: UUID(),
                    fullName: "Taylor Prospect",
                    companyName: "Preview Company",
                    reasonForOutreach: "This content maps well to the user’s positioning.",
                    suggestedAngle: "Lead with workflow modernization outcomes.",
                    opportunityId: UUID()
                )
            ]
        )
    }
}
