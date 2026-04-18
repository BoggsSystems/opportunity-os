import Foundation

protocol AuthServiceProtocol {
    func signUp(email: String, password: String) async throws -> AuthSession
    func signIn(email: String, password: String) async throws -> AuthSession
    func signOut(accessToken: String?) async
}

@MainActor
final class SessionManager: ObservableObject {
    private enum StorageKeys {
        static let hasSeenWelcome = "opportunity_os.has_seen_welcome"
        static let lastSignedInEmail = "opportunity_os.last_signed_in_email"
        static let persistedSession = "opportunity_os.persisted_session"
    }

    @Published var session: AuthSession?
    @Published var voicePreference: VoicePreference = PreviewData.voicePreference

    private let defaults: UserDefaults

    var isAuthenticated: Bool {
        session != nil
    }

    var shouldShowWelcome: Bool {
        !defaults.bool(forKey: StorageKeys.hasSeenWelcome)
    }

    var preferredAuthMode: AuthEntryMode {
        shouldShowWelcome ? .signUp : .signIn
    }

    var lastSignedInEmail: String? {
        defaults.string(forKey: StorageKeys.lastSignedInEmail)
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: StorageKeys.persistedSession),
           let session = try? JSONDecoder().decode(AuthSession.self, from: data) {
            self.session = session
        }
    }

    func start(session: AuthSession) {
        self.session = session
        defaults.set(session.user.email, forKey: StorageKeys.lastSignedInEmail)
        defaults.set(true, forKey: StorageKeys.hasSeenWelcome)
        if let data = try? JSONEncoder().encode(session) {
            defaults.set(data, forKey: StorageKeys.persistedSession)
        }
    }

    func markWelcomeSeen() {
        defaults.set(true, forKey: StorageKeys.hasSeenWelcome)
    }

    func clear() {
        session = nil
        defaults.removeObject(forKey: StorageKeys.persistedSession)
    }
}

protocol SpeechRecognitionServiceProtocol {
    func startListening() async throws
    func stopListening() async
    func latestTranscript() async -> String
    func listenForUtterance() async throws -> String
}

protocol SpeechSynthesisServiceProtocol {
    func speak(_ text: String, preference: VoicePreference) async
    func enqueueSpeech(_ text: String, preference: VoicePreference) async
    func waitForSpeechQueue() async
    func stopSpeaking() async
}

protocol VoicePreferenceServiceProtocol {
    func loadPreference() async -> VoicePreference
    func savePreference(_ preference: VoicePreference) async
    func parseNaturalLanguageVoiceRequest(_ request: String, current: VoicePreference) async -> VoicePreference
}

protocol AssistantConversationServiceProtocol {
    func respond(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) async throws -> AssistantConversationReply

    func streamResponse(
        to message: String,
        sessionId: String?,
        history: [AssistantConversationMessage],
        context: AssistantConversationContext
    ) throws -> AsyncThrowingStream<AssistantConversationStreamChunk, Error>
}

protocol OpportunityServiceProtocol {
    func fetchRecommendedOpportunities() async -> [Opportunity]
    func fetchOpportunity(id: UUID) async -> Opportunity?
}

protocol NextActionServiceProtocol {
    func fetchTopNextAction() async -> NextAction?
}

protocol OpportunityScanServiceProtocol {
    func runScan() async -> [ScanResult]
}

protocol FollowUpServiceProtocol {
    func fetchFollowUps() async -> [FollowUpItem]
}

protocol MessageDraftServiceProtocol {
    func generateDraft(for opportunity: Opportunity) async -> OutreachMessage
}

protocol EmailServiceProtocol {
    func send(_ message: OutreachMessage) async throws
}

protocol CampaignServiceProtocol {
    func fetchCampaigns() async -> [Campaign]
}

protocol ContentDiscoveryServiceProtocol {
    func fetchDiscoveredContent() async -> [ContentItem]
    func uploadContent(from fileURL: URL) async throws -> ContentUploadResult
    func executeContent(itemId: UUID, maxTargets: Int) async throws -> ContentExecutionResult
}
