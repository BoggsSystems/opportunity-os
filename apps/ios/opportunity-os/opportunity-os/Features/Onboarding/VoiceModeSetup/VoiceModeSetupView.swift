import SwiftUI

struct VoiceModeSetupView: View {
    @StateObject var viewModel: VoiceModeSetupViewModel
    let onboardingPlan: StrategicPlan?
    let onContinue: () -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                voiceHeroRegion

                if let onboardingPlan {
                    carryForwardCard(onboardingPlan)
                }

                setupSummaryCard

                Button(onboardingPlan == nil ? "Enter Opportunity OS" : "Review First Cycle") {
                    Task {
                        await self.viewModel.confirmSetup()
                        self.onContinue()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .controlSize(.large)
                .accessibilityIdentifier("onboarding.enterApp")

                Text("You can change voice and interaction preferences anytime from Settings.")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.mutedText)
            }
            .padding(24)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Voice Setup")
        .accessibilityIdentifier("screen.voiceSetup")
        .task {
            await self.viewModel.load()
            self.viewModel.playPromptIfNeeded()
        }
    }

    private var voiceHeroRegion: some View {
        VStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Tune your workflow")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(onboardingPlan == nil ? "Tell the assistant how you want Opportunity OS to guide you." : "Tell the assistant how you want it to guide this first real cycle.")
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
                    viewModel.speakCurrentSetup()
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)

                Button("Play Sample") {
                    viewModel.playSample()
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

    private func carryForwardCard(_ onboardingPlan: StrategicPlan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Carrying your first goal forward")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
            Text(onboardingPlan.confirmationMessage)
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var setupSummaryCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Current Setup")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            Label(viewModel.interactionMode.title, systemImage: "hand.tap")
                .font(.subheadline)
                .foregroundStyle(AppTheme.primaryText)

            Label(viewModel.voicePreference.displayName, systemImage: "waveform")
                .font(.subheadline)
                .foregroundStyle(AppTheme.primaryText)

            Text(viewModel.voicePreference.styleDescription)
                .font(.body)
                .foregroundStyle(AppTheme.mutedText)
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
            return "I’m listening for your setup preference."
        case .thinking:
            return "Updating your setup…"
        case .speaking:
            return "Speaking now."
        case .ready:
            return "Say something like voice first, touch first, or calm Canadian voice."
        }
    }

    private var primaryVoiceButtonTitle: String {
        switch viewModel.voiceState {
        case .listening:
            return "Listening…"
        case .thinking, .speaking:
            return "Interrupt and Talk"
        case .ready:
            return "Set by Voice"
        }
    }
}
