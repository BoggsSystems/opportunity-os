import Foundation

@MainActor
final class WelcomeViewModel: ObservableObject {
    @Published var greeting = "We’ll introduce you to our AI assistant, help you feel how they work, and then get started on your first real opportunity cycle."

    private let speechSynthesisService: SpeechSynthesisServiceProtocol

    init(speechSynthesisService: SpeechSynthesisServiceProtocol) {
        self.speechSynthesisService = speechSynthesisService
    }

    func playGreeting() {
        Task {
            await self.speechSynthesisService.speak(self.greeting, preference: PreviewData.voicePreference)
        }
    }
}
