import Foundation

protocol AuthServiceProtocol {
    func signIn(email: String, password: String) async throws -> AuthSession
    func signOut() async
}

@MainActor
final class SessionManager: ObservableObject {
    @Published var session: AuthSession?
    @Published var voicePreference: VoicePreference = PreviewData.voicePreference

    var isAuthenticated: Bool {
        session != nil
    }

    func start(session: AuthSession) {
        self.session = session
    }

    func clear() {
        session = nil
    }
}

protocol SpeechRecognitionServiceProtocol {
    func startListening() async throws
    func stopListening() async
    func latestTranscript() async -> String
}

protocol SpeechSynthesisServiceProtocol {
    func speak(_ text: String, preference: VoicePreference) async
    func stopSpeaking() async
}

protocol VoicePreferenceServiceProtocol {
    func loadPreference() async -> VoicePreference
    func savePreference(_ preference: VoicePreference) async
    func parseNaturalLanguageVoiceRequest(_ request: String, current: VoicePreference) async -> VoicePreference
}

protocol OpportunityServiceProtocol {
    func fetchRecommendedOpportunities() async -> [Opportunity]
    func fetchOpportunity(id: UUID) async -> Opportunity?
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
}
