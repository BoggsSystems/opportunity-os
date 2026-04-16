import Foundation

@MainActor
final class WelcomeViewModel: ObservableObject {
    @Published var greeting = "Welcome. I’ll help you move through each outreach cycle one action at a time."

    private let speechSynthesisService: SpeechSynthesisServiceProtocol

    init(speechSynthesisService: SpeechSynthesisServiceProtocol) {
        self.speechSynthesisService = speechSynthesisService
    }

    func playGreeting() {
        Task {
            await speechSynthesisService.speak(greeting, preference: PreviewData.voicePreference)
        }
    }
}
