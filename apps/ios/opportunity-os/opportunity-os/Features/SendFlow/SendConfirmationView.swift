import SwiftUI
import MessageUI

struct SendConfirmationView: View {
    @StateObject var viewModel: SendConfirmationViewModel
    let onSent: (OutreachMessage) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Confirm Send")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)

            Text(viewModel.message.subject)
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            // Body preview
            Text(viewModel.message.body)
                .font(.body)
                .foregroundStyle(AppTheme.mutedText)
                .lineLimit(8)
                .padding(.vertical, 4)

            Text("Recipients")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.primaryText)
            ForEach(viewModel.message.recipients) { recipient in
                HStack {
                    VStack(alignment: .leading) {
                        Text("\(recipient.name) • \(recipient.organization)")
                            .foregroundStyle(AppTheme.primaryText)
                        if let email = recipient.email {
                            Text(email)
                                .font(.caption)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                    }
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }

            if let result = viewModel.sendResult {
                resultBanner(result)
            }

            Spacer()

            Button {
                viewModel.openMailCompose()
            } label: {
                HStack {
                    Image(systemName: "envelope.fill")
                    Text("Open in Mail")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .accessibilityIdentifier("sendConfirmation.openMail")

        }
        .padding()
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .accessibilityIdentifier("screen.sendConfirmation")
        .sheet(isPresented: $viewModel.showMailCompose) {
            MailComposeView(
                subject: viewModel.message.subject,
                body: viewModel.message.body,
                recipients: viewModel.recipientEmails,
                onDismiss: { result in
                    viewModel.handleMailResult(result)
                    if result == .sent {
                        onSent(viewModel.message)
                    }
                }
            )
            .ignoresSafeArea()
        }
    }

    @ViewBuilder
    private func resultBanner(_ result: SendConfirmationViewModel.SendResult) -> some View {
        switch result {
        case .sent:
            Label("Email sent successfully!", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.subheadline.weight(.medium))
        case .saved:
            Label("Draft saved to your mailbox.", systemImage: "tray.fill")
                .foregroundStyle(.orange)
                .font(.subheadline.weight(.medium))
        case .cancelled:
            Label("Cancelled — draft not sent.", systemImage: "xmark.circle")
                .foregroundStyle(AppTheme.mutedText)
                .font(.subheadline.weight(.medium))
        case .failed(let msg):
            Label(msg, systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .font(.subheadline.weight(.medium))
        }
    }
}
