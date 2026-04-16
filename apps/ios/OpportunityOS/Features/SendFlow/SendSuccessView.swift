import SwiftUI

struct SendSuccessView: View {
    let message: OutreachMessage
    let onReturnHome: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "paperplane.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(AppTheme.orbSecondary)
            Text("Message Sent")
                .font(.largeTitle.weight(.bold))
            Text("The cycle is complete for now. Return home and we’ll pick the next meaningful action.")
                .multilineTextAlignment(.center)
                .foregroundStyle(AppTheme.mutedText)
            Button("Back to Cycle") {
                onReturnHome()
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            Spacer()
        }
        .padding()
        .background(AppTheme.background.ignoresSafeArea())
        .foregroundStyle(Color.white)
    }
}
