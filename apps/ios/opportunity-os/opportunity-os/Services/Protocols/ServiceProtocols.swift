import Foundation

protocol AuthServiceProtocol {
    func signUp(email: String, password: String, guestSessionId: String?) async throws -> AuthSession
    func signIn(email: String, password: String) async throws -> AuthSession
    func signOut(accessToken: String?) async
}

@MainActor
final class SessionManager: ObservableObject {
    private enum StorageKeys {
        static let hasSeenWelcome = "opportunity_os.has_seen_welcome"
        static let lastSignedInEmail = "opportunity_os.last_signed_in_email"
        static let persistedSession = "opportunity_os.persisted_session"
        static let lastActiveTimestamp = "opportunity_os.last_active_timestamp"
        static let guestSessionId = "opportunity_os.guest_session_id"
    }

    @Published var session: AuthSession?
    @Published var guestSessionId: String
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
        
        if let existingGuestId = defaults.string(forKey: StorageKeys.guestSessionId) {
            self.guestSessionId = existingGuestId
        } else {
            let newId = UUID().uuidString
            defaults.set(newId, forKey: StorageKeys.guestSessionId)
            self.guestSessionId = newId
        }

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

    func recordActivity() {
        defaults.set(Date().timeIntervalSince1970, forKey: StorageKeys.lastActiveTimestamp)
    }

    func clear() {
        session = nil
        defaults.removeObject(forKey: StorageKeys.persistedSession)
        defaults.removeObject(forKey: StorageKeys.lastActiveTimestamp)
    }

    func resetForFreshStart() {
        session = nil
        defaults.removeObject(forKey: StorageKeys.persistedSession)
        defaults.removeObject(forKey: StorageKeys.hasSeenWelcome)
        defaults.removeObject(forKey: StorageKeys.lastSignedInEmail)
        defaults.removeObject(forKey: StorageKeys.lastActiveTimestamp)
    }
}

protocol SpeechRecognitionServiceProtocol {
    var onSpeechDetected: (() -> Void)? { get set }
    var activeSynthesizedText: String? { get set }
    var isRecording: Bool { get }
    func startListening() async throws
    func stopListening() async
    func latestTranscript() async -> String
    func listenForUtterance() async throws -> String
    func stopTranscription()
}

protocol SpeechSynthesisServiceProtocol {
    func speak(_ text: String, preference: VoicePreference) async
    func enqueueSpeech(_ text: String, preference: VoicePreference) async
    func waitForSpeechQueue() async
    func stopSpeaking() async
    func playRawAudio(_ data: Data)
    var isSpeaking: Bool { get }
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
