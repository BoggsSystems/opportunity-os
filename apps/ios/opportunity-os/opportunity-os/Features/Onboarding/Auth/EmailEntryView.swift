import SwiftUI

struct EmailEntryView: View {
    @StateObject var viewModel: EmailEntryViewModel
    let onboardingPlan: OnboardingPlan?
    let onContinue: (String) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                voiceHeroRegion

                if let onboardingPlan {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("What we’re carrying forward")
                            .font(.headline)
                            .foregroundStyle(AppTheme.primaryText)
                        Text(onboardingPlan.firstCycleTitle)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("We’ll use this account to save your first cycle around \(onboardingPlan.targetAudience).")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
                    .shadow(color: AppTheme.shadow, radius: 24, y: 12)
                }

                capturedEmailCard

                Button("Continue") {
                    onContinue(viewModel.email)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .controlSize(.large)
                .disabled(!viewModel.isValid)
                .accessibilityIdentifier("onboarding.emailContinue")

                Text(
                    viewModel.mode == .signUp
                        ? "We’ll create your first workspace and keep your setup ready for the next time you open the app."
                        : "We’ll reconnect your saved cycle, settings, and voice preferences."
                )
                    .font(.footnote)
                    .foregroundStyle(AppTheme.mutedText)
            }
            .padding(24)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Email")
        .accessibilityIdentifier("screen.emailEntry")
    }

    private var voiceHeroRegion: some View {
        VStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(viewModel.mode.title)
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(onboardingPlan?.confirmationMessage ?? viewModel.mode.emailPrompt)
                    .font(.body)
                    .foregroundStyle(AppTheme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: viewModel.toggleListening) {
                VoiceOrbView(isListening: viewModel.voiceState != .ready, pulse: true)
                    .frame(width: 220, height: 220)
            }
            .buttonStyle(.plain)

            Text(orbCaptionText)
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
                .multilineTextAlignment(.center)

            if !viewModel.transcript.isEmpty {
                Text(viewModel.transcript)
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(AppTheme.secondaryBackground, in: Capsule())
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 12) {
                Button(primaryVoiceButtonTitle) {
                    viewModel.toggleListening()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .disabled(viewModel.voiceState == .listening)

                Button("Read Back") {
                    viewModel.speakCurrentValue()
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 34, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var capturedEmailCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Captured Email")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            Text(viewModel.email.isEmpty ? "Your email will appear here after you speak it." : viewModel.email)
                .font(.body)
                .foregroundStyle(viewModel.email.isEmpty ? AppTheme.mutedText : AppTheme.primaryText)
                .textSelection(.enabled)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.secondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(AppTheme.border))
                .accessibilityIdentifier("onboarding.email")
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var orbCaptionText: String {
        switch viewModel.voiceState {
        case .listening:
            return "I’m listening for your email."
        case .thinking:
            return "Processing your email…"
        case .speaking:
            return "Speaking now."
        case .ready:
            return viewModel.isValid ? "I’ve got your email." : "Say your email address naturally."
        }
    }

    private var primaryVoiceButtonTitle: String {
        switch viewModel.voiceState {
        case .listening:
            return "Listening…"
        case .thinking, .speaking:
            return "Interrupt and Talk"
        case .ready:
            return "Say Email"
        }
    }
}
