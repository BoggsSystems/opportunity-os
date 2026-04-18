import SwiftUI

struct HomeView: View {
    @StateObject var viewModel: HomeViewModel
    let onOpenOpportunities: () -> Void
    let onOpenContent: () -> Void
    let onContinueCycle: (Opportunity) -> Void
    let onOpenSettings: () -> Void

    private let transcriptAnchor = "transcriptAnchor"
    private let workspaceAnchor = "workspaceAnchor"

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    sessionHeader
                    voiceHeroRegion
                    transcriptRegion
                        .id(transcriptAnchor)
                    contextualWorkspaceRegion
                        .id(workspaceAnchor)
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 32)
            }
            .background(AppTheme.pageBackground.ignoresSafeArea())
            .accessibilityIdentifier("screen.home")
            .task {
                await viewModel.load()
            }
            .onChange(of: viewModel.workspaceState) { _, state in
                withAnimation(.spring(response: 0.46, dampingFraction: 0.9)) {
                    proxy.scrollTo(scrollTarget(for: state), anchor: state == .nextAction || state == .empty ? .top : .center)
                }
            }
        }
    }

    private var sessionHeader: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Opportunity OS")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                Text("Voice-led guidance with action context kept calm and close by.")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            Button(action: onOpenSettings) {
                Image(systemName: "slider.horizontal.3")
                    .font(.headline.weight(.semibold))
            }
            .buttonStyle(.bordered)
            .tint(AppTheme.accent)
            .accessibilityIdentifier("home.openSettings")
        }
    }

    private var voiceHeroRegion: some View {
        VStack(alignment: .center, spacing: 18) {
            SessionSectionLabel(
                title: "Voice Assistant",
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

            HStack(spacing: 10) {
                sessionStatusChip(
                    title: viewModel.assistantSessionId == nil ? "Fresh Session" : "Live Session",
                    systemImage: viewModel.assistantSessionId == nil ? "sparkles" : "waveform.badge.mic"
                )

                Button(viewModel.assistantSessionId == nil ? "Start Fresh" : "New Conversation") {
                    viewModel.resetConversationSession()
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)
                .disabled(viewModel.voiceState == .listening || viewModel.voiceState == .thinking)
            }

            Toggle(isOn: Binding(
                get: { viewModel.isContinuousVoiceModeEnabled },
                set: { viewModel.setContinuousVoiceModeEnabled($0) }
            )) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Continuous Voice")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text("After the assistant responds, the session returns to listening so the conversation can keep flowing.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .toggleStyle(.switch)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(AppTheme.secondaryBackground.opacity(0.3), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AppTheme.border)
            )

            if !viewModel.transcript.isEmpty {
                Text(viewModel.transcript)
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedText)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(AppTheme.accentSoft, in: Capsule())
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

    private var transcriptRegion: some View {
        VStack(alignment: .leading, spacing: 16) {
            SessionSectionLabel(
                title: "Conversation",
                subtitle: conversationSubtitleText,
                systemImage: "text.bubble"
            )

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(displayMessages) { message in
                        messageBubble(message)
                    }
                }
                .padding(.vertical, 4)
            }
            .frame(minHeight: 180, maxHeight: 280)

            assistantComposerSurface
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(AppTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(AppTheme.border)
        )
        .shadow(color: AppTheme.shadow, radius: 20, y: 10)
    }

    private var assistantComposerSurface: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Use text when you want to clarify, correct, or steer the conversation.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)

            HStack(alignment: .bottom, spacing: 12) {
                TextField("Ask a question or refine the next move…", text: $viewModel.composerText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 15)
                    .frame(minHeight: 58)
                    .background(AppTheme.secondaryBackground.opacity(0.38), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(AppTheme.border)
                    )

                Button(action: viewModel.submitTextMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 34))
                        .foregroundStyle(AppTheme.accent)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var conversationSubtitleText: String {
        switch viewModel.voiceState {
        case .listening:
            return "I’m listening now. Your spoken turn will appear here as it’s understood."
        case .thinking:
            return "I’m interpreting the last turn and preparing the next response."
        case .speaking:
            return "The assistant reply unfolds here while it is being spoken."
        case .ready:
            return "Latest assistant output stays visible, with recent history scrollable beneath it."
        }
    }

    private var contextualWorkspaceRegion: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Action Workspace")
                        .font(.headline)
                        .foregroundStyle(AppTheme.accent)
                    Text(viewModel.currentWorkspaceTitle)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text(workspaceSummaryText)
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                cycleMeter
            }

            cycleTrack

            if let errorMessage = viewModel.errorMessage {
                statusStrip(errorMessage, color: .red)
            }

            workspaceBody

            if let content = viewModel.contentItems.first {
                contextDock(content)
            }
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(AppTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(AppTheme.border)
        )
        .shadow(color: AppTheme.shadow, radius: 18, y: 10)
    }

    @ViewBuilder
    private var workspaceBody: some View {
        switch viewModel.workspaceState {
        case .nextAction:
            nextActionWorkspace
        case .discovery(let item):
            discoveryWorkspace(item)
        case .drafting(let opportunity):
            loadingDraftWorkspace(opportunity)
        case .draftReady(let message):
            draftWorkspace(message)
        case .completion(let title, let detail):
            completionWorkspace(title: title, detail: detail)
        case .empty:
            emptyWorkspace
        }
    }

    private var nextActionWorkspace: some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Surfaced",
                title: viewModel.nextAction?.title ?? "Ready for the next cycle",
                detail: viewModel.nextAction?.reason ?? "I’m ready to guide the next meaningful step."
            )

            Button(primaryActionTitle) {
                viewModel.startPrimaryAction()
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .controlSize(.large)
            .accessibilityIdentifier("home.nextRecommendedAction")

            HStack(spacing: 12) {
                Button("Opportunity Scan", action: onOpenOpportunities)
                    .buttonStyle(.bordered)
                    .tint(AppTheme.accent)

                Button("Content Discovery", action: onOpenContent)
                    .buttonStyle(.bordered)
                    .tint(AppTheme.accent)
            }
        }
    }

    private func discoveryWorkspace(_ item: ContentItem) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Pursued",
                title: item.title,
                detail: item.summary.isEmpty ? item.campaignPotential : item.summary
            )

            if let linkedOfferingName = item.linkedOfferingName {
                statusStrip("Linked offering: \(linkedOfferingName)", color: AppTheme.accent)
            }

            Button(viewModel.isExecutingWorkspaceAction ? "Generating Targets..." : "Generate Outreach Targets") {
                viewModel.executeDiscoveryItem(item)
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .disabled(viewModel.isExecutingWorkspaceAction)

            Button("Open Full Discovery", action: onOpenContent)
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)
        }
    }

    private func loadingDraftWorkspace(_ opportunity: Opportunity) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Executing",
                title: "Preparing outreach for \(opportunity.companyName)",
                detail: "I’m turning the current opportunity context into a draft while keeping the assistant conversation present above."
            )

            ProgressView()
                .tint(AppTheme.accent)
        }
    }

    private func draftWorkspace(_ message: OutreachMessage) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Executed",
                title: message.subject,
                detail: "The draft is ready here in the workspace. You can send it now or keep steering the wording through the conversation above."
            )

            Text(message.body)
                .font(.subheadline)
                .foregroundStyle(AppTheme.primaryText)
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.secondaryBackground.opacity(0.35), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(AppTheme.border)
                )

            HStack(spacing: 12) {
                Button(viewModel.isExecutingWorkspaceAction ? "Sending..." : "Send Now") {
                    viewModel.sendDraft()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .disabled(viewModel.isExecutingWorkspaceAction)

                Button("Later") {
                    viewModel.resetToNextAction()
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.accent)
            }
        }
    }

    private func completionWorkspace(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Cycle Complete",
                title: title,
                detail: detail
            )

            Button("Begin Next Cycle") {
                viewModel.resetToNextAction()
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
        }
    }

    private var emptyWorkspace: some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspacePromptCard(
                eyebrow: "Awaiting Context",
                title: "Ready for the next cycle",
                detail: "Nothing is queued yet. Import content or open opportunity scan to start the operational loop."
            )

            HStack(spacing: 12) {
                Button("Opportunity Scan", action: onOpenOpportunities)
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)
                    .accessibilityIdentifier("home.nextRecommendedAction")
                Button("Content Discovery", action: onOpenContent)
                    .buttonStyle(.bordered)
                    .tint(AppTheme.accent)
            }
        }
    }

    private func messageBubble(_ message: SessionMessage) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Label(message.role == .assistant ? "Assistant" : "You", systemImage: message.role == .assistant ? "sparkles" : "person.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(message.role == .assistant ? AppTheme.accent : AppTheme.mutedText)

                Text(message.text)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                message.role == .assistant ? AppTheme.secondaryBackground.opacity(0.42) : AppTheme.surface,
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(message.role == .assistant ? AppTheme.border : AppTheme.accent.opacity(0.18))
            )
        }
    }

    private var cycleMeter: some View {
        ZStack {
            Circle()
                .stroke(AppTheme.border, lineWidth: 8)
            Circle()
                .trim(from: 0, to: min(max(viewModel.cycle.progress, 0.02), 1))
                .stroke(AppTheme.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))

            VStack(spacing: 3) {
                Text("\(Int(viewModel.cycle.progress * 100))%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                Text(viewModel.cycle.currentStep.rawValue.capitalized)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(AppTheme.mutedText)
            }
        }
        .frame(width: 76, height: 76)
    }

    private var cycleTrack: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Momentum Loop")
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
                Spacer()
                Text(sessionPhaseTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AppTheme.accentSoft, in: Capsule())
            }

            HStack(spacing: 8) {
                ForEach(sessionPhases, id: \.title) { phase in
                    VStack(spacing: 8) {
                        Circle()
                            .fill(phase.isActive ? AppTheme.accent : AppTheme.border.opacity(0.85))
                            .frame(width: phase.isActive ? 12 : 9, height: phase.isActive ? 12 : 9)
                        Text(phase.title)
                            .font(.system(size: 10, weight: phase.isActive ? .semibold : .medium))
                            .foregroundStyle(phase.isActive ? AppTheme.primaryText : AppTheme.mutedText)
                            .multilineTextAlignment(.center)
                    }

                    if phase.title != sessionPhases.last?.title {
                        Capsule()
                            .fill(phase.isComplete ? AppTheme.accent.opacity(0.8) : AppTheme.border)
                            .frame(maxWidth: .infinity)
                            .frame(height: 3)
                    }
                }
            }
        }
        .padding(18)
        .background(AppTheme.secondaryBackground.opacity(0.28), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func contextDock(_ content: ContentItem) -> some View {
        Button {
            viewModel.openDiscoveryItem(content)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text("Context Nearby")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.accent)
                Text(content.title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
                Text(content.campaignPotential)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
                    .lineLimit(2)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.secondaryBackground.opacity(0.32), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(AppTheme.border)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("home.contentDiscoveryCard")
    }

    private func statusStrip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func sessionStatusChip(title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.accent)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(AppTheme.accentSoft, in: Capsule())
    }

    private var displayMessages: [SessionMessage] {
        Array(viewModel.messages.suffix(8))
    }

    private var heroStatusText: String {
        switch viewModel.workspaceState {
        case .nextAction:
            return voiceModeSummary("The assistant is holding the current recommendation in focus.")
        case .discovery:
            return voiceModeSummary("Discovery context is active while voice guidance stays central.")
        case .drafting:
            return voiceModeSummary("The assistant is preparing the next communication step.")
        case .draftReady:
            return voiceModeSummary("A live draft is ready while the conversation stays available.")
        case .completion:
            return voiceModeSummary("The cycle is confirmed and ready to renew.")
        case .empty:
            return voiceModeSummary("The assistant is ready for the next actionable signal.")
        }
    }

    private var orbCaptionText: String {
        switch viewModel.voiceState {
        case .ready:
            return "Tap the orb to start a live voice conversation. I’ll listen for a natural pause, then respond."
        case .listening:
            return "I’m listening now. Just speak naturally and I’ll take the pause as your turn ending."
        case .thinking:
            return "I heard you. I’m forming the next response now. You can interrupt if you want to jump back in."
        case .speaking:
            return "I’m speaking now. You can interrupt any time and take the floor."
        }
    }

    private var primaryVoiceButtonTitle: String {
        switch viewModel.voiceState {
        case .ready:
            return "Start Voice Conversation"
        case .listening:
            return "Listening…"
        case .thinking:
            return "Jump Back In"
        case .speaking:
            return "Interrupt Assistant"
        }
    }

    private var workspaceSummaryText: String {
        switch viewModel.workspaceState {
        case .nextAction:
            return "This lower region carries the current action while the voice assistant remains primary."
        case .discovery:
            return "Discovery execution stays nearby without taking over the voice conversation."
        case .drafting:
            return "The operational step is running while the assistant remains visibly present."
        case .draftReady:
            return "Review and execute the draft here, with the conversation still above."
        case .completion:
            return "The action is confirmed here before the next cycle begins."
        case .empty:
            return "This secondary region is ready to host the next operational action."
        }
    }

    private var primaryActionTitle: String {
        if viewModel.shouldRouteToDiscovery {
            return "Open Discovery"
        }
        if viewModel.nextActionOpportunity != nil || !viewModel.opportunities.isEmpty {
            return "Draft Outreach"
        }
        return "Start Next Action"
    }

    private var sessionPhaseTitle: String {
        switch viewModel.workspaceState {
        case .nextAction, .empty:
            return "Surfaced"
        case .discovery:
            return "Pursued"
        case .drafting, .draftReady:
            return "Executed"
        case .completion:
            return "Confirmed"
        }
    }

    private var sessionPhases: [SessionPhase] {
        let activeIndex: Int
        switch viewModel.workspaceState {
        case .nextAction, .empty:
            activeIndex = 0
        case .discovery:
            activeIndex = 1
        case .drafting, .draftReady:
            activeIndex = 2
        case .completion:
            activeIndex = 3
        }

        let labels = ["Surfaced", "Pursued", "Executed", "Confirmed", "Renew"]
        return labels.enumerated().map { index, label in
            SessionPhase(title: label, isActive: index == activeIndex, isComplete: index < activeIndex)
        }
    }

    private func scrollTarget(for state: SessionWorkspaceState) -> String {
        switch state {
        case .nextAction, .empty:
            return transcriptAnchor
        case .discovery, .drafting, .draftReady, .completion:
            return workspaceAnchor
        }
    }

    private func voiceModeSummary(_ base: String) -> String {
        switch viewModel.voiceState {
        case .ready:
            return "\(base) Voice mode is standing by for the next turn."
        case .listening:
            return "\(base) The assistant is actively listening."
        case .thinking:
            return "\(base) The assistant is interpreting what you just said, but you can interrupt and keep the conversation moving."
        case .speaking:
            return "\(base) The assistant is speaking the response back."
        }
    }
}

private struct SessionSectionLabel: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.accent)
            Text(subtitle)
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
        }
    }
}

private struct WorkspacePromptCard: View {
    let eyebrow: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.accent)
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(AppTheme.primaryText)
            Text(detail)
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.secondaryBackground.opacity(0.32), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(AppTheme.border)
        )
    }
}

private struct SessionPhase {
    let title: String
    let isActive: Bool
    let isComplete: Bool
}
