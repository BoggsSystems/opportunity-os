import SwiftUI

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

            Text("Recipients")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.primaryText)
            ForEach(viewModel.message.recipients) { recipient in
                Text("\(recipient.name) • \(recipient.organization)")
                    .foregroundStyle(AppTheme.mutedText)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }

            Spacer()

            Button(viewModel.isSending ? "Sending..." : "Send Now") {
                Task {
                    if await self.viewModel.send() {
                        self.onSent(self.viewModel.message)
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .disabled(viewModel.isSending)
            .accessibilityIdentifier("sendConfirmation.sendNow")
        }
        .padding()
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .accessibilityIdentifier("screen.sendConfirmation")
    }
}
