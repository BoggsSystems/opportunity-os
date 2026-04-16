import Foundation

@MainActor
final class VoiceModeSetupViewModel: ObservableObject {
    @Published var interactionMode: InteractionMode = .voiceFirst
    @Published var voicePreference: VoicePreference = PreviewData.voicePreference

    private let sessionManager: SessionManager
    private let voicePreferenceService: VoicePreferenceServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol

    init(
        sessionManager: SessionManager,
        voicePreferenceService: VoicePreferenceServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol
    ) {
        self.sessionManager = sessionManager
        self.voicePreferenceService = voicePreferenceService
        self.speechSynthesisService = speechSynthesisService
    }

    func load() async {
        voicePreference = await voicePreferenceService.loadPreference()
        interactionMode = sessionManager.session?.user.preferredInteractionMode ?? .voiceFirst
    }

    func confirmSetup() async {
        sessionManager.voicePreference = voicePreference
        await voicePreferenceService.savePreference(voicePreference)
    }

    func playSample() {
        Task {
            await speechSynthesisService.speak(
                "Voice setup is ready. We can move into your next cycle whenever you are.",
                preference: voicePreference
            )
        }
    }
}
