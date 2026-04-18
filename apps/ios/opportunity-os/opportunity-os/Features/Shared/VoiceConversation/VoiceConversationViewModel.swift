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
            if self.isListening {
                await self.recognitionService.stopListening()
                self.transcript = await self.recognitionService.latestTranscript()
                self.isListening = false
            } else {
                try? await self.recognitionService.startListening()
                self.isListening = true
            }
        }
    }

    func speakResponse() {
        Task {
            await self.synthesisService.speak(self.assistantResponse, preference: self.sessionManager.voicePreference)
        }
    }
}
