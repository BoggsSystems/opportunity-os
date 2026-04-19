import Foundation
import MessageUI

@MainActor
final class SendConfirmationViewModel: ObservableObject {
    @Published var isSending = false
    @Published var errorMessage: String?
    @Published var showMailCompose = false
    @Published var sendResult: SendResult?

    enum SendResult {
        case sent
        case saved
        case cancelled
        case failed(String)
    }

    let message: OutreachMessage
    private let emailService: EmailServiceProtocol

    init(message: OutreachMessage, emailService: EmailServiceProtocol) {
        self.message = message
        self.emailService = emailService
    }

    var recipientEmails: [String] {
        message.recipients.compactMap(\.email)
    }

    var canSendNatively: Bool {
        canSendMailNatively()
    }

    func openMailCompose() {
        if canSendNatively {
            showMailCompose = true
        } else {
            // Fallback: try to open mailto: URL (works on device even without MFMailCompose)
            if let url = mailtoURL(for: message) {
                UIApplication.shared.open(url)
            } else {
                errorMessage = "No email account is configured on this device."
            }
        }
    }

    func handleMailResult(_ result: MFMailComposeResult) {
        showMailCompose = false
        switch result {
        case .sent:
            sendResult = .sent
            // Log the activity via our service
            Task {
                try? await emailService.send(message)
            }
        case .saved:
            sendResult = .saved
        case .cancelled:
            sendResult = .cancelled
        case .failed:
            sendResult = .failed("The email could not be sent. Please try again.")
        @unknown default:
            sendResult = .failed("An unknown error occurred.")
        }
    }

    /// Legacy path — send through the backend stub
    func send() async -> Bool {
        isSending = true
        defer { isSending = false }

        do {
            try await emailService.send(message)
            sendResult = .sent
            return true
        } catch {
            errorMessage = "Send failed."
            return false
        }
    }
}
