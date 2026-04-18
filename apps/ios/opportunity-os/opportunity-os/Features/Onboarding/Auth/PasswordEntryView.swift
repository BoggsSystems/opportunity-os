import SwiftUI

struct PasswordEntryView: View {
    @StateObject var viewModel: PasswordEntryViewModel
    let onboardingPlan: OnboardingPlan?
    let onAuthenticated: () -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                voiceHeroRegion

                if let onboardingPlan {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("First cycle ready")
                            .font(.headline)
                            .foregroundStyle(AppTheme.primaryText)
                        Text(onboardingPlan.firstDraftPrompt)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
                    .shadow(color: AppTheme.shadow, radius: 24, y: 12)
                }

                capturedPasswordCard

                Button(
                    viewModel.isLoading
                        ? (viewModel.mode == .signUp ? "Creating Account..." : "Signing In...")
                        : viewModel.mode.primaryActionTitle
                ) {
                    Task {
                        if await self.viewModel.submit() {
                            self.onAuthenticated()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .controlSize(.large)
                .disabled(viewModel.password.count < 6 || viewModel.isLoading)
                .accessibilityIdentifier("onboarding.passwordContinue")

                Text(
                    viewModel.mode == .signUp
                        ? "This password will be used the next time you come back after signing out."
                        : "Your credentials stay on-device until a secure request is made to your account."
                )
                    .font(.footnote)
                    .foregroundStyle(AppTheme.mutedText)

                #if DEBUG
                VStack(alignment: .leading, spacing: 6) {
                    Text("Debug Connection")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text("\(APIConfiguration.debugEnvironmentLabel): \(APIConfiguration.debugBaseURLString)")
                        .font(.caption.monospaced())
                        .foregroundStyle(AppTheme.mutedText)
                        .textSelection(.enabled)
                }
                .padding(.top, 4)
                #endif
            }
            .padding(24)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Password")
        .accessibilityIdentifier("screen.passwordEntry")
        .task {
            viewModel.playPromptIfNeeded()
        }
    }

    private var voiceHeroRegion: some View {
        VStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(viewModel.mode == .signUp ? "Secure your account" : "Secure sign in")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(onboardingPlan?.assistantSummary ?? viewModel.mode.passwordPrompt)
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

    private var capturedPasswordCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Captured Password")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            Text(maskedPassword)
                .font(.body.monospaced())
                .foregroundStyle(viewModel.password.isEmpty ? AppTheme.mutedText : AppTheme.primaryText)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.secondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(AppTheme.border))
                .accessibilityIdentifier("onboarding.password")

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("onboarding.passwordError")
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var maskedPassword: String {
        guard !viewModel.password.isEmpty else {
            return "Your password will appear here as a masked value after you speak it."
        }

        return String(repeating: "•", count: max(6, viewModel.password.count))
    }

    private var orbCaptionText: String {
        switch viewModel.voiceState {
        case .listening:
            return "I’m listening for your password."
        case .thinking:
            return "Processing your password…"
        case .speaking:
            return "Speaking now."
        case .ready:
            return viewModel.password.count >= 6 ? "I’ve got your password." : "Say the password you want to use."
        }
    }

    private var primaryVoiceButtonTitle: String {
        switch viewModel.voiceState {
        case .listening:
            return "Listening…"
        case .thinking, .speaking:
            return "Interrupt and Talk"
        case .ready:
            return "Say Password"
        }
    }
}
