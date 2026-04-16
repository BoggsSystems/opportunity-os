import SwiftUI

struct SendConfirmationView: View {
    @StateObject var viewModel: SendConfirmationViewModel
    let onSent: (OutreachMessage) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Confirm Send")
                .font(.largeTitle.weight(.bold))

            Text(viewModel.message.subject)
                .font(.headline)

            Text("Recipients")
                .font(.subheadline.weight(.semibold))
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
                    if await viewModel.send() {
                        onSent(viewModel.message)
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .disabled(viewModel.isSending)
        }
        .padding()
        .background(AppTheme.background.ignoresSafeArea())
        .foregroundStyle(Color.white)
    }
}
