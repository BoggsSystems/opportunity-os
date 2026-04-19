import SwiftUI
import MessageUI

struct GoalDiscoveryView: View {
    @StateObject var viewModel: GoalDiscoveryViewModel
    let onContinue: (OnboardingPlan) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                voiceHeroRegion

                conversationSummary

                controls
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 32)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationTitle("Meet Your Assistant")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen.goalDiscovery")
        .task {
            viewModel.onFinishRequest = onContinue
            viewModel.playIntroductionIfNeeded()
        }
        .sheet(item: $viewModel.pendingEmailDraft) { draft in
            if MFMailComposeViewController.canSendMail() {
                MailComposeView(
                    subject: draft.subject,
                    body: draft.body,
                    recipients: draft.recipients.compactMap(\.email),
                    onDismiss: { result in
                        viewModel.handleMailResult(result, for: draft)
                    }
                )
                .ignoresSafeArea()
            } else {
                // Fallback for Simulator / devices without Mail configured
                VStack(spacing: 20) {
                    Image(systemName: "envelope.badge.shield.half.filled")
                        .font(.system(size: 48))
                        .foregroundStyle(AppTheme.accent)
                    Text("Mail Not Available")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text("Mail is not configured on this device. On a real iPhone the email draft would open directly in your Mail app.")
                        .font(.body)
                        .foregroundStyle(AppTheme.mutedText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Subject: \(draft.subject)")
                            .font(.headline)
                        Text(draft.body)
                            .font(.body)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                    .padding()
                    .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 24)

                    Button("Dismiss") {
                        viewModel.handleMailResult(.cancelled, for: draft)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)
                }
                .padding()
                .background(AppTheme.pageBackground.ignoresSafeArea())
            }
        }
    }

    private var voiceHeroRegion: some View {
        VStack(alignment: .center, spacing: 18) {
            sectionLabel(
                title: "Voice Onboarding",
                subtitle: heroStatusText,
                systemImage: "waveform"
            )
            .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: viewModel.toggleListening) {
                VoiceOrbView(isListening: viewModel.voiceState != .ready, pulse: true)
                    .frame(width: 220, height: 220)
            }
            .buttonStyle(.plain)
            .padding(.top, 6)

            Text(orbCaptionText)
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 320)

            if let assistantText = viewModel.latestAssistantMessage {
                Text(assistantText)
                    .font(.body)
                    .foregroundStyle(AppTheme.primaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .background(AppTheme.accentSoft, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .frame(maxWidth: .infinity)
            }

            if !viewModel.transcript.isEmpty {
                Text(viewModel.transcript)
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedText)
                    .lineLimit(3)
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
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(AppTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .stroke(AppTheme.border)
        )
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private func planPreview(_ plan: OnboardingPlan) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("What I’m hearing")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
            Text(plan.confirmationMessage)
                .font(.body)
                .foregroundStyle(AppTheme.primaryText)

            VStack(alignment: .leading, spacing: 8) {
                Label(plan.opportunityType.capitalized, systemImage: "scope")
                Label(plan.targetAudience, systemImage: "person.2")
                Label(plan.firstCycleTitle, systemImage: "flag")
            }
            .font(.subheadline)
            .foregroundStyle(AppTheme.mutedText)
        }
        .padding(22)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var conversationSummary: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionLabel(
                title: "Conversation Flow",
                subtitle: conversationSubtitleText,
                systemImage: "text.bubble"
            )

            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(viewModel.recentMessages.enumerated()), id: \.offset) { _, message in
                    HStack {
                        if message.role == .assistant {
                            Text(message.text)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.primaryText)
                                .padding(12)
                                .background(AppTheme.accentSoft, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            Spacer(minLength: 26)
                        } else {
                            Spacer(minLength: 26)
                            Text(message.text)
                                .font(.subheadline)
                                .foregroundStyle(Color.white)
                                .padding(12)
                                .background(AppTheme.accent, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    }
                }
            }
        }
        .padding(22)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Button(primaryVoiceButtonTitle) {
                    viewModel.toggleListening()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .disabled(viewModel.voiceState == .listening)

                Button("Hear Assistant") {
                    viewModel.speakLatestAssistantMessage()
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)
                .disabled(viewModel.voiceState == .listening || viewModel.voiceState == .thinking)
            }
        }
    }

    private func sectionLabel(title: String, subtitle: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(AppTheme.accent)
                .frame(width: 28, height: 28)
                .background(AppTheme.accentSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)

                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var heroStatusText: String {
        switch viewModel.voiceState {
        case .listening:
            return "The orb is listening now. Speak naturally and pause when you’re done."
        case .thinking:
            return "The assistant is interpreting your goal and shaping the first cycle."
        case .speaking:
            return "The assistant is responding out loud and keeping the flow moving."
        case .ready:
            return "Tap the orb to talk, or let the assistant keep guiding you after the intro."
        }
    }

    private var orbCaptionText: String {
        switch viewModel.voiceState {
        case .listening:
            return "I’m listening."
        case .thinking:
            return "Thinking through your first move…"
        case .speaking:
            return "Speaking now."
        case .ready:
            return viewModel.canContinue
                ? "I’ve got enough to shape your first cycle."
                : "Tell me what you want to make happen."
        }
    }

    private var conversationSubtitleText: String {
        switch viewModel.voiceState {
        case .listening:
            return "Your latest spoken turn appears here as the assistant hears it."
        case .thinking:
            return "The assistant is turning what you said into a suggested first cycle."
        case .speaking:
            return "The latest reply stays visible while the voice response plays."
        case .ready:
            return "This stays lightweight and voice-led so the orb remains the main interaction."
        }
    }

    private var primaryVoiceButtonTitle: String {
        switch viewModel.voiceState {
        case .listening:
            return "Listening…"
        case .thinking:
            return "Interrupt and Talk"
        case .speaking:
            return "Interrupt and Talk"
        case .ready:
            return "Talk to Assistant"
        }
    }
}
