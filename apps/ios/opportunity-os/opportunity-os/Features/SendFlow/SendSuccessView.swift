import SwiftUI

struct SendSuccessView: View {
    let message: OutreachMessage
    let onReturnHome: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "paperplane.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(AppTheme.accent)
            Text("Message Sent")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)
            Text("The cycle is complete for now. Return home and we’ll pick the next meaningful action.")
                .multilineTextAlignment(.center)
                .foregroundStyle(AppTheme.mutedText)
            Button("Back to Cycle") {
                onReturnHome()
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .accessibilityIdentifier("sendSuccess.backToCycle")
            Spacer()
        }
        .padding()
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .accessibilityIdentifier("screen.sendSuccess")
    }
}
