import Foundation

@MainActor
final class PasswordEntryViewModel: ObservableObject {
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var transcript = ""
    @Published var voiceState: VoiceConversationState = .ready

    let email: String
    let mode: AuthEntryMode
    let promptText: String
    private let authService: AuthServiceProtocol
    private let sessionManager: SessionManager
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private var hasPlayedPrompt = false
    private var voiceTurnTask: Task<Void, Never>?

    init(
        email: String,
        mode: AuthEntryMode,
        authService: AuthServiceProtocol,
        sessionManager: SessionManager,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        initialPassword: String? = nil
    ) {
        self.email = email
        self.mode = mode
        self.authService = authService
        self.sessionManager = sessionManager
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
        self.password = initialPassword ?? ""
        self.promptText = mode == .signUp
            ? "Now tell me the password you want to use for this account."
            : "Now tell me the password for this account."
    }

    func submit() async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let session: AuthSession
            switch mode {
            case .signUp:
                session = try await authService.signUp(email: email, password: password)
            case .signIn:
                session = try await authService.signIn(email: email, password: password)
            }
            sessionManager.start(session: session)
            return true
        } catch {
            #if DEBUG
            print("[PasswordEntryViewModel] auth failed for \(email): \(error.localizedDescription)")
            #endif
            errorMessage = error.localizedDescription
            return false
        }
    }

    func playPromptIfNeeded() {
        guard !hasPlayedPrompt else { return }
        hasPlayedPrompt = true

        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(promptText, preference: sessionManager.voicePreference)
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

    func speakCurrentValue() {
        let masked = password.isEmpty ? promptText : "I heard a password with \(password.count) characters."
        Task {
            voiceState = .speaking
            await speechSynthesisService.speak(masked, preference: sessionManager.voicePreference)
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
                password = normalizeSpokenPassword(utterance)
                voiceState = .ready
            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                voiceState = .ready
            }
        }
    }

    private func normalizeSpokenPassword(_ utterance: String) -> String {
        utterance
            .replacingOccurrences(of: " ", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
