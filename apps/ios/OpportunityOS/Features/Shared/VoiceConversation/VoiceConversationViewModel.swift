import Foundation

@MainActor
final class VoiceConversationViewModel: ObservableObject {
    @Published var transcript = ""
    @Published var isListening = false
    @Published var assistantResponse = "Ask me to scan, draft, follow up, or switch voices."

    private let recognitionService: SpeechRecognitionServiceProtocol
    private let synthesisService: SpeechSynthesisServiceProtocol
    private let sessionManager: SessionManager

    init(
        recognitionService: SpeechRecognitionServiceProtocol,
        synthesisService: SpeechSynthesisServiceProtocol,
        sessionManager: SessionManager
    ) {
        self.recognitionService = recognitionService
        self.synthesisService = synthesisService
        self.sessionManager = sessionManager
    }

    func toggleListening() {
        Task {
            if isListening {
                await recognitionService.stopListening()
                transcript = await recognitionService.latestTranscript()
                isListening = false
            } else {
                try? await recognitionService.startListening()
                isListening = true
            }
        }
    }

    func speakResponse() {
        Task {
            await synthesisService.speak(assistantResponse, preference: sessionManager.voicePreference)
        }
    }
}
