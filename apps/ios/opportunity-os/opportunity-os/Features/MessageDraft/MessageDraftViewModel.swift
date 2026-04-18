import Foundation

@MainActor
final class MessageDraftViewModel: ObservableObject {
    @Published var draft: OutreachMessage?
    @Published var isLoading = false

    let opportunity: Opportunity
    private let messageDraftService: MessageDraftServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol

    init(
        opportunity: Opportunity,
        messageDraftService: MessageDraftServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol
    ) {
        self.opportunity = opportunity
        self.messageDraftService = messageDraftService
        self.speechSynthesisService = speechSynthesisService
    }

    func load() async {
        isLoading = true
        draft = await messageDraftService.generateDraft(for: opportunity)
        isLoading = false
    }

    func speakDraft() {
        guard let draft else { return }
        Task {
            await self.speechSynthesisService.speak(draft.body, preference: PreviewData.voicePreference)
        }
    }
}
