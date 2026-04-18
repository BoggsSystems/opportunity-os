import SwiftUI

struct WelcomeView: View {
    @StateObject var viewModel: WelcomeViewModel
    let onContinue: () -> Void
    let onUseTestAccount: () -> Void

    var body: some View {
        ZStack {
            AppTheme.pageBackground.ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer(minLength: 24)

                VStack(spacing: 22) {
                    VoiceOrbView(isListening: false)

                    VStack(spacing: 12) {
                        Text("Opportunity OS")
                            .font(.largeTitle.weight(.bold))
                            .foregroundStyle(AppTheme.primaryText)
                        Text("Meet your AI assistant")
                            .font(.headline.weight(.medium))
                            .foregroundStyle(AppTheme.accent)
                        Text(viewModel.greeting)
                            .font(.body)
                            .foregroundStyle(AppTheme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 34)
                .frame(maxWidth: .infinity)
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).stroke(AppTheme.border))
                .shadow(color: AppTheme.shadow, radius: 28, y: 14)

                Spacer()

                VStack(spacing: 12) {
                    Button("Get Started", action: onContinue)
                        .buttonStyle(.borderedProminent)
                        .tint(AppTheme.accent)
                        .controlSize(.large)
                        .accessibilityIdentifier("onboarding.getStarted")
                }
            }
            .padding(24)
        }
        .accessibilityIdentifier("screen.welcome")
    }
}
