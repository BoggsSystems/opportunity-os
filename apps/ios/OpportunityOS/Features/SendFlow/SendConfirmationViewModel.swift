import Foundation

@MainActor
final class SendConfirmationViewModel: ObservableObject {
    @Published var isSending = false
    @Published var errorMessage: String?

    let message: OutreachMessage
    private let emailService: EmailServiceProtocol

    init(message: OutreachMessage, emailService: EmailServiceProtocol) {
        self.message = message
        self.emailService = emailService
    }

    func send() async -> Bool {
        isSending = true
        defer { isSending = false }

        do {
            try await emailService.send(message)
            return true
        } catch {
            errorMessage = "Send failed."
            return false
        }
    }
}
