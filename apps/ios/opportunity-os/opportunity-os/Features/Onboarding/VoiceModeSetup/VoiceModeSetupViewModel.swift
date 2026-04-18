import Foundation

@MainActor
final class VoiceModeSetupViewModel: ObservableObject {
    @Published var interactionMode: InteractionMode = .voiceFirst
    @Published var voicePreference: VoicePreference = PreviewData.voicePreference
    @Published var transcript = ""
    @Published var errorMessage: String?
    @Published var voiceState: VoiceConversationState = .ready

    private let sessionManager: SessionManager
    private let voicePreferenceService: VoicePreferenceServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private var hasPlayedPrompt = false
    private var voiceTurnTask: Task<Void, Never>?

    init(
        sessionManager: SessionManager,
        voicePreferenceService: VoicePreferenceServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        speechRecognitionService: SpeechRecognitionServiceProtocol
    ) {
        self.sessionManager = sessionManager
        self.voicePreferenceService = voicePreferenceService
        self.speechSynthesisService = speechSynthesisService
        self.speechRecognitionService = speechRecognitionService
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
            voiceState = .speaking
            await self.speechSynthesisService.speak(
                "Voice setup is ready. We can move into your next cycle whenever you are.",
                preference: self.voicePreference
            )
            voiceState = .ready
        }
    }

    func playPromptIfNeeded() {
        guard !hasPlayedPrompt else { return }
        hasPlayedPrompt = true

        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(
                "You can keep this voice-first, or say touch first if you want a quieter interface. You can also ask for a calm, fast, British, American, or Canadian voice.",
                preference: voicePreference
            )
            voiceState = .ready
            beginVoiceCapture()
        }
    }

    func toggleListening() {
        switch voiceState {
        case .ready:
            beginVoiceCapture()
        case .listening:
            return
        case .thinking, .speaking:
            Task {
                await speechSynthesisService.stopSpeaking()
                voiceState = .ready
                beginVoiceCapture()
            }
        }
    }

    func applySpokenPreferences() async {
        let request = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !request.isEmpty else { return }

        voiceState = .thinking
        let lowercased = request.lowercased()

        if lowercased.contains("touch first") || lowercased.contains("touch mode") {
            interactionMode = .touchFirst
        } else if lowercased.contains("voice first") || lowercased.contains("voice mode") {
            interactionMode = .voiceFirst
        }

        voicePreference = await voicePreferenceService.parseNaturalLanguageVoiceRequest(
            request,
            current: voicePreference
        )

        let confirmation = "I’ve set you to \(interactionMode.title.lowercased()) with the \(voicePreference.displayName) voice."
        voiceState = .speaking
        await speechSynthesisService.speak(confirmation, preference: voicePreference)
        voiceState = .ready
    }

    func speakCurrentSetup() {
        let summary = "You’re set to \(interactionMode.title.lowercased()) with \(voicePreference.displayName), \(voicePreference.styleDescription)."
        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(summary, preference: voicePreference)
            voiceState = .ready
        }
    }

    private func beginVoiceCapture() {
        voiceTurnTask?.cancel()
        voiceTurnTask = Task {
            errorMessage = nil
            transcript = ""
            voiceState = .listening

            do {
                let utterance = try await speechRecognitionService.listenForUtterance()
                transcript = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                await applySpokenPreferences()
            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                voiceState = .ready
            }
        }
    }
}
