import Foundation

struct StubAuthService: AuthServiceProtocol {
    func signIn(email: String, password: String) async throws -> AuthSession {
        // TODO: Replace with real API-backed authentication.
        let user = User(
            id: UUID(),
            firstName: "Jeff",
            lastName: "Boggs",
            email: email,
            preferredInteractionMode: .voiceFirst
        )
        return AuthSession(token: "preview-token", user: user, startedAt: Date())
    }

    func signOut() async {}
}

final class StubSpeechRecognitionService: SpeechRecognitionServiceProtocol {
    private var transcript = "Switch to a British female voice."

    func startListening() async throws {
        // TODO: Integrate Speech framework / transcription pipeline.
    }

    func stopListening() async {}

    func latestTranscript() async -> String {
        transcript
    }
}

struct StubSpeechSynthesisService: SpeechSynthesisServiceProtocol {
    func speak(_ text: String, preference: VoicePreference) async {
        // TODO: Integrate AVSpeechSynthesizer or server-side voice output.
        print("Speaking with \(preference.displayName): \(text)")
    }

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

struct StubOpportunityService: OpportunityServiceProtocol {
    func fetchRecommendedOpportunities() async -> [Opportunity] {
        PreviewData.opportunities
    }

    func fetchOpportunity(id: UUID) async -> Opportunity? {
        PreviewData.opportunities.first(where: { $0.id == id })
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
}
