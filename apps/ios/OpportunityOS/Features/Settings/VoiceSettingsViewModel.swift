import Foundation

@MainActor
final class VoiceSettingsViewModel: ObservableObject {
    @Published var preference: VoicePreference = PreviewData.voicePreference
    @Published var naturalLanguageRequest = "Switch to a British female voice."
    @Published var transcript = ""

    private let sessionManager: SessionManager
    private let voicePreferenceService: VoicePreferenceServiceProtocol
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol

    init(
        sessionManager: SessionManager,
        voicePreferenceService: VoicePreferenceServiceProtocol,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol
    ) {
        self.sessionManager = sessionManager
        self.voicePreferenceService = voicePreferenceService
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
    }

    func load() async {
        preference = await voicePreferenceService.loadPreference()
    }

    func applyNaturalLanguageRequest() async {
        preference = await voicePreferenceService.parseNaturalLanguageVoiceRequest(
            naturalLanguageRequest,
            current: preference
        )
        sessionManager.voicePreference = preference
        await voicePreferenceService.savePreference(preference)
    }

    func sampleVoice() {
        Task {
            await speechSynthesisService.speak(
                "Voice settings updated. Here is a sample of your current assistant voice.",
                preference: preference
            )
        }
    }

    func captureVoiceRequest() {
        Task {
            try? await speechRecognitionService.startListening()
            await speechRecognitionService.stopListening()
            transcript = await speechRecognitionService.latestTranscript()
            naturalLanguageRequest = transcript
        }
    }
}
