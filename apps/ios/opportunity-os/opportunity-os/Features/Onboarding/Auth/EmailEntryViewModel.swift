import Foundation

@MainActor
final class EmailEntryViewModel: ObservableObject {
    @Published var email = ""
    @Published var transcript = ""
    @Published var errorMessage: String?
    @Published var voiceState: VoiceConversationState = .ready
    let mode: AuthEntryMode
    let promptText: String

    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private var hasPlayedPrompt = false
    private var voiceTurnTask: Task<Void, Never>?

    init(
        mode: AuthEntryMode,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        initialEmail: String? = nil
    ) {
        self.mode = mode
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
        self.email = initialEmail ?? ""
        self.promptText = mode == .signUp
            ? "Tell me the email you want to use for your account."
            : "Tell me the email for the account you want to reopen."
    }

    var isValid: Bool {
        email.contains("@") && email.contains(".")
    }

    func playPromptIfNeeded() {
        guard !hasPlayedPrompt else { return }
        hasPlayedPrompt = true

        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(promptText, preference: PreviewData.voicePreference)
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

    private func beginVoiceCapture() {
        voiceTurnTask?.cancel()
        voiceTurnTask = Task {
            errorMessage = nil
            transcript = ""
            voiceState = .listening

            do {
                let utterance = try await speechRecognitionService.listenForUtterance()
                let normalized = normalizeSpokenEmail(utterance)
                transcript = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                email = normalized
                voiceState = .ready
            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                voiceState = .ready
            }
        }
    }

    func speakCurrentValue() {
        let text = isValid ? "I heard \(email)." : promptText
        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(text, preference: PreviewData.voicePreference)
            voiceState = .ready
        }
    }

    private func normalizeSpokenEmail(_ utterance: String) -> String {
        utterance
            .lowercased()
            .replacingOccurrences(of: " at ", with: "@")
            .replacingOccurrences(of: " at", with: "@")
            .replacingOccurrences(of: " dot ", with: ".")
            .replacingOccurrences(of: " dot", with: ".")
            .replacingOccurrences(of: " underscore ", with: "_")
            .replacingOccurrences(of: " dash ", with: "-")
            .replacingOccurrences(of: " ", with: "")
    }
}
