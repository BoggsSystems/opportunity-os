import AVFoundation
import Foundation
import SwiftUI
import MessageUI

// MARK: - Global Assistant Shell Models

enum AssistantSessionMode: Hashable {
    case onboarding(OnboardingPhase)
    case pro
}

enum OnboardingPhase: Hashable {
    case introduction
    case discovery
    case identityRequest
}

enum UnifiedWorkspaceState: Hashable {
    // Onboarding States
    case onboardingIntro
    case onboardingDiscovery
    case onboardingIdentity
    
    // Pro Workspace States
    case dashboard              // Overview of momentum and next steps
    case opportunityFocus       // Specific opportunity details
    case opportunityList        // Browse all recommendations
    case discoveryFocus         // Specific content/news item
    case discoveryInventory     // Browse all discovered content
    case outreachDrafting       // Active email drafting
    case activityLog            // Past actions
    case settings               // Voice & Account preferences
}

// MARK: - Unified Assistant ViewModel

@MainActor
final class UnifiedAssistantViewModel: ObservableObject {
    @Published var sessionMode: AssistantSessionMode = .onboarding(.introduction)
    @Published var workspaceState: UnifiedWorkspaceState = .onboardingIntro
    
    // Voice & Chat State
    @Published var messages: [SessionMessage] = []
    @Published var transcript = ""
    @Published var voiceState: VoiceConversationState = .ready
    @Published var assistantSessionId: String?
    @Published var isContinuousVoiceModeEnabled = true
    @Published var errorMessage: String?
    @Published var composerText = ""
    
    // Data State
    @Published var opportunities: [Opportunity] = []
    @Published var contentItems: [ContentItem] = []
    @Published var nextAction: NextAction?
    @Published var activeOpportunity: Opportunity?
    @Published var activeContentItem: ContentItem?
    @Published var pendingEmailDraft: OutreachMessage?
    @Published var isLoading = false
    @Published var isExecutingAction = false
    
    // Onboarding specific
    @Published var onboardingPlan: OnboardingPlan?
    @Published var onboardingEmail = ""
    @Published var onboardingPassword = ""
    
    private let opportunityService: OpportunityServiceProtocol
    private let nextActionService: NextActionServiceProtocol
    private let followUpService: FollowUpServiceProtocol
    private let contentDiscoveryService: ContentDiscoveryServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let assistantConversationService: AssistantConversationServiceProtocol
    private let messageDraftService: MessageDraftServiceProtocol
    private let emailService: EmailServiceProtocol
    private let authService: AuthServiceProtocol
    let sessionManager: SessionManager
    let apiClient: OpportunityOSAPIClient
    
    private var voiceTurnTask: Task<Void, Never>?
    private var assistantResponseTask: Task<Void, Never>?
    
    init(
        opportunityService: OpportunityServiceProtocol,
        nextActionService: NextActionServiceProtocol,
        followUpService: FollowUpServiceProtocol,
        contentDiscoveryService: ContentDiscoveryServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        assistantConversationService: AssistantConversationServiceProtocol,
        messageDraftService: MessageDraftServiceProtocol,
        emailService: EmailServiceProtocol,
        authService: AuthServiceProtocol,
        sessionManager: SessionManager,
        apiClient: OpportunityOSAPIClient
    ) {
        self.opportunityService = opportunityService
        self.nextActionService = nextActionService
        self.followUpService = followUpService
        self.contentDiscoveryService = contentDiscoveryService
        self.speechSynthesisService = speechSynthesisService
        self.speechRecognitionService = speechRecognitionService
        self.assistantConversationService = assistantConversationService
        self.messageDraftService = messageDraftService
        self.emailService = emailService
        self.authService = authService
        self.sessionManager = sessionManager
        self.apiClient = apiClient
        
        setupInitialState()
    }
    
    private func setupInitialState() {
        if sessionManager.isAuthenticated {
            sessionMode = .pro
            workspaceState = .dashboard
            Task { await loadProData() }
        } else {
            sessionMode = .onboarding(.introduction)
            workspaceState = .onboardingIntro
            messages = [
                SessionMessage(role: .assistant, text: "Welcome to Opportunity OS. I’m your voice assistant, here to help you turn strategy into action. Let’s start by figuring out what kind of opportunities you want to create.")
            ]
        }
    }
    
    // MARK: - Core Loading
    
    func loadProData() async {
        isLoading = true
        defer { isLoading = false }
        
        opportunities = await opportunityService.fetchRecommendedOpportunities()
        nextAction = await nextActionService.fetchTopNextAction()
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        
        if workspaceState == .onboardingIntro || workspaceState == .onboardingIdentity {
            workspaceState = .dashboard
        }
    }
    
    // MARK: - Voice Interaction Logic
    
    func toggleListening() {
        if workspaceState == .onboardingIntro {
            withAnimation {
                workspaceState = .onboardingDiscovery
            }
        }
        
        switch voiceState {
        case .ready:
            beginVoiceConversationTurn()
        case .listening:
            return
        case .thinking, .speaking:
            Task { await interruptConversationAndResumeListening() }
        }
    }
    
    private func beginVoiceConversationTurn() {
        voiceTurnTask?.cancel()
        voiceTurnTask = Task {
            errorMessage = nil
            transcript = ""
            voiceState = .listening
            
            do {
                let utterance = try await speechRecognitionService.listenForUtterance()
                let normalized = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                transcript = normalized
                
                guard !normalized.isEmpty else {
                    voiceState = .ready
                    if isContinuousVoiceModeEnabled { beginVoiceConversationTurn() }
                    return
                }
                
                // Route navigation commands
                if routeCommand(normalized) { return }
                
                voiceState = .thinking
                await processUserMessage(normalized, shouldSpeakResponse: true)
                
            } catch {
                errorMessage = error.localizedDescription
                voiceState = .ready
                if isContinuousVoiceModeEnabled { beginVoiceConversationTurn() }
            }
        }
    }
    
    private func routeCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        
        if lower.contains("show my opportunities") || lower.contains("view recommendations") {
            withAnimation { workspaceState = .opportunityList }
            return true
        }
        
        if lower.contains("go to settings") || lower.contains("open settings") {
            withAnimation { workspaceState = .settings }
            return true
        }
        
        if lower.contains("show my content") || lower.contains("view discovery") {
            withAnimation { workspaceState = .discoveryInventory }
            return true
        }
        
        if lower.contains("back to home") || lower.contains("go home") {
            withAnimation { workspaceState = .dashboard }
            return true
        }
        
        return false
    }
    
    private func interruptConversationAndResumeListening() async {
        voiceTurnTask?.cancel()
        assistantResponseTask?.cancel()
        await speechSynthesisService.stopSpeaking()
        voiceState = .ready
        beginVoiceConversationTurn()
    }
    
    private func processUserMessage(_ text: String, shouldSpeakResponse: Bool) async {
        messages.append(SessionMessage(role: .user, text: text))
        
        let messageId = UUID()
        messages.append(SessionMessage(id: messageId, role: .assistant, text: "..."))
        
        assistantResponseTask = Task {
            voiceState = .speaking
            do {
                let context = buildAssistantContext()
                let reply = try await assistantConversationService.respond(
                    to: text,
                    sessionId: assistantSessionId,
                    history: conversationHistory,
                    context: context
                )
                
                assistantSessionId = reply.sessionId
                updateAssistantMessage(id: messageId, text: reply.text)
                
                if reply.shouldBeSilent {
                    voiceState = .ready
                    if isContinuousVoiceModeEnabled { beginVoiceConversationTurn() }
                    return
                }
                
                await speechSynthesisService.speak(reply.text, preference: sessionManager.voicePreference)
                voiceState = .ready
                if isContinuousVoiceModeEnabled { beginVoiceConversationTurn() }
            } catch {
                errorMessage = error.localizedDescription
                updateAssistantMessage(id: messageId, text: "I'm having trouble connecting right now.")
                voiceState = .ready
            }
        }
        await assistantResponseTask?.value
    }
    
    // MARK: - Identity & Auth
    
    func signUp() {
        guard !onboardingEmail.isEmpty && !onboardingPassword.isEmpty else { return }
        isExecutingAction = true
        Task {
            do {
                let session = try await authService.signUp(email: onboardingEmail, password: onboardingPassword)
                sessionManager.start(session: session)
                withAnimation {
                    sessionMode = .pro
                    workspaceState = .dashboard
                }
                await loadProData()
                messages.append(SessionMessage(role: .assistant, text: "Welcome aboard! Your first cycle is ready."))
            } catch {
                errorMessage = "Signup failed: \(error.localizedDescription)"
            }
            isExecutingAction = false
        }
    }
    
    // MARK: - Workspace Actions
    
    func focusOpportunity(_ opportunity: Opportunity) {
        withAnimation {
            activeOpportunity = opportunity
            workspaceState = .opportunityFocus
        }
    }
    
    func focusContent(_ item: ContentItem) {
        withAnimation {
            activeContentItem = item
            workspaceState = .discoveryFocus
        }
    }
    
    func handleMailResult(_ result: MFMailComposeResult, for draft: OutreachMessage) {
        pendingEmailDraft = nil
        if result == .sent {
            messages.append(SessionMessage(role: .assistant, text: "Email sent! I've updated the cycle status."))
            Task {
                try? await emailService.send(draft)
                await processUserMessage("[SYSTEM]: User sent the outreach email.", shouldSpeakResponse: true)
            }
        } else {
            beginVoiceConversationTurn()
        }
    }
    
    // MARK: - Helpers
    
    private func buildAssistantContext() -> AssistantConversationContext {
        AssistantConversationContext(
            workspaceState: "\(workspaceState)",
            nextAction: nextAction,
            opportunity: activeOpportunity,
            contentItem: activeContentItem
        )
    }
    
    private var conversationHistory: [AssistantConversationMessage] {
        messages.map { AssistantConversationMessage(role: $0.role == .assistant ? .assistant : .user, text: $0.text) }
    }
    
    private func updateAssistantMessage(id: UUID, text: String) {
        if let index = messages.firstIndex(where: { $0.id == id }) {
            messages[index].text = text
        }
    }
}

// MARK: - Global Assistant View (The Shell)

struct UnifiedAssistantView: View {
    @StateObject var viewModel: UnifiedAssistantViewModel
    
    var body: some View {
        ZStack {
            AppTheme.pageBackground.ignoresSafeArea()
            
            VStack(spacing: 0) {
                assistantHeroRegion
                    .frame(maxHeight: .infinity)
            }
        }
        .sheet(item: $viewModel.pendingEmailDraft) { draft in
            MailComposeView(
                subject: draft.subject,
                body: draft.body,
                recipients: draft.recipients.compactMap(\.email),
                onDismiss: { result in viewModel.handleMailResult(result, for: draft) }
            )
        }
    }
    
    // MARK: - Assistant Hero
    
    private var assistantHeroRegion: some View {
        VStack(spacing: 0) {
            header
                .padding(.bottom, 8)
            
            VStack(spacing: 0) {
                // Top: Voice Interaction
                VStack(spacing: 24) {
                    Button(action: viewModel.toggleListening) {
                        VoiceOrbView(isListening: viewModel.voiceState != .ready, pulse: true)
                            .frame(width: 180, height: 180)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 40)
                    
                    Text(orbCaption)
                        .font(.caption.weight(.bold))
                        .tracking(2)
                        .foregroundStyle(AppTheme.accent)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 40)
                
                // Bottom: Chat History (Flexible)
                VStack(spacing: 0) {
                    Divider()
                        .background(AppTheme.border.opacity(0.3))
                    
                    AssistantChatHistoryView(messages: viewModel.messages)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .background(AppTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 32))
            .shadow(color: AppTheme.shadow, radius: 20, y: 10)
            .padding(.horizontal)
            .padding(.bottom, 20)
        }
    }
    
    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Opportunity OS")
                    .font(.headline.weight(.bold))
                Text(modeSubtitle)
                    .font(.caption2)
                    .foregroundStyle(AppTheme.mutedText)
            }
            Spacer()
        }
        .padding(.horizontal)
        .padding(.top)
    }
    
    // MARK: - Legacy Workspace Components (kept for reuse in other views)
    
    @ViewBuilder
    private var workspaceContent: some View {
        switch viewModel.workspaceState {
        case .onboardingIntro:
            OnboardingIntroView(onStart: { viewModel.toggleListening() })
            
        case .onboardingDiscovery:
            DiscoveryOnboardingWorkspaceView(viewModel: viewModel)
            
        case .onboardingIdentity:
            IdentitySetupView(email: $viewModel.onboardingEmail, password: $viewModel.onboardingPassword, onSignUp: { viewModel.signUp() })
            
        case .dashboard:
            DashboardWorkspaceView(viewModel: viewModel)
            
        case .opportunityList:
            OpportunityListWorkspaceView(opportunities: viewModel.opportunities, onSelect: { viewModel.focusOpportunity($0) })
            
        case .opportunityFocus:
            if let opp = viewModel.activeOpportunity {
                OpportunityDetailWorkspaceView(opportunity: opp, onBack: { viewModel.workspaceState = .opportunityList })
            }
            
        case .discoveryInventory:
            ContentListWorkspaceView(items: viewModel.contentItems, onSelect: { viewModel.focusContent($0) })
            
        case .settings:
            SettingsWorkspaceView(viewModel: viewModel)
            
        default:
            Text("Ready for your next command.")
                .foregroundStyle(AppTheme.mutedText)
                .padding()
        }
    }
    
    // MARK: - Onboarding Discovery View
    
    struct DiscoveryOnboardingWorkspaceView: View {
        @ObservedObject var viewModel: UnifiedAssistantViewModel
        
        var body: some View {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Building Your Strategy", systemImage: "sparkles")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                    
                    Text("I'm analyzing your goals to generate your first set of opportunities.")
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
                
                VStack(alignment: .leading, spacing: 16) {
                    Text("COMING SOON")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(AppTheme.mutedText)
                    
                    HStack(spacing: 12) {
                        PlaceholderCard(title: "Target Companies", icon: "building.2")
                        PlaceholderCard(title: "Contact Leads", icon: "person.2")
                    }
                }
            }
        }
    }
    
    struct PlaceholderCard: View {
        let title: String
        let icon: String
        var body: some View {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(AppTheme.mutedText)
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(AppTheme.mutedText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 30)
            .background(AppTheme.surface.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(AppTheme.border.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [5]))
            )
        }
    }
    
    // MARK: - Chat History Component
    
    struct AssistantChatHistoryView: View {
        let messages: [SessionMessage]
        
        var body: some View {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages) { _ in
                    Task {
                        try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s delay for layout pass
                        withAnimation(.spring()) {
                            proxy.scrollTo(messages.last?.id, anchor: .bottom)
                        }
                    }
                }
                .onAppear {
                    proxy.scrollTo(messages.last?.id, anchor: .bottom)
                }
            }
            .background(AppTheme.secondaryBackground.opacity(0.3))
        }
    }
    
    struct ChatBubble: View {
        let message: SessionMessage
        
        var body: some View {
            HStack(alignment: .top, spacing: 12) {
                if message.role == .assistant {
                    Circle()
                        .fill(AppTheme.accentSoft)
                        .frame(width: 24, height: 24)
                        .overlay(
                            Image(systemName: "sparkles")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(AppTheme.accent)
                        )
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.role == .assistant ? "ASSISTANT" : "YOU")
                        .font(.system(size: 8, weight: .black))
                        .tracking(1)
                        .foregroundStyle(AppTheme.mutedText)
                    
                    Text(message.text)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(message.role == .assistant ? AppTheme.primaryText : AppTheme.accent)
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                Spacer()
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(message.role == .assistant ? AppTheme.surface : AppTheme.accentSoft.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(AppTheme.border.opacity(0.5), lineWidth: 0.5)
            )
        }
    }
    
    // MARK: - Local Helpers
    
    private var orbCaption: String {
        switch viewModel.voiceState {
        case .ready: return "TAP TO TALK"
        case .listening: return "I'M LISTENING"
        case .thinking: return "THINKING"
        case .speaking: return "SPEAKING"
        }
    }
    
    private var modeSubtitle: String {
        switch viewModel.sessionMode {
        case .onboarding: return "Setup Mode"
        case .pro: return "Pro Mode"
        }
    }
    
    private var workspaceTitle: String {
        switch viewModel.workspaceState {
        case .onboardingIntro: return "Welcome"
        case .onboardingDiscovery: return "Discovery"
        case .onboardingIdentity: return "Identity"
        case .dashboard: return "Strategy Dashboard"
        case .opportunityList: return "Recommendations"
        case .opportunityFocus: return "Opportunity Focus"
        case .discoveryInventory: return "Discovered Content"
        case .settings: return "Preferences"
        default: return "Active Session"
        }
    }
}

// MARK: - Modular Workspace Components

struct OnboardingIntroView: View {
    let onStart: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("I'm here to help you turn high-level goals into tactical outreach.")
                .font(.headline)
            Text("We'll start by talking through what you're looking for, then I'll generate a custom outreach engine for you.")
                .foregroundStyle(AppTheme.mutedText)
            Button("Start Talking", action: onStart)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding()
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct IdentitySetupView: View {
    @Binding var email: String
    @Binding var password: String
    let onSignUp: () -> Void
    var body: some View {
        VStack(spacing: 16) {
            TextField("Email Address", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("Create Password", text: $password)
                .textFieldStyle(.roundedBorder)
            Button("Secure My Account", action: onSignUp)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding()
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct DashboardWorkspaceView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let action = viewModel.nextAction {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Next Best Move", systemImage: "bolt.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                    Text(action.title)
                        .font(.title3.weight(.bold))
                    Text(action.reason)
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.mutedText)
                }
                .padding()
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
            }
            
            HStack(spacing: 16) {
                MetricCard(title: "Active", value: "\(viewModel.opportunities.count)", icon: "target")
                MetricCard(title: "Discovery", value: "\(viewModel.contentItems.count)", icon: "doc.text.magnifyingglass")
            }
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(AppTheme.accent)
            Text(value)
                .font(.title.weight(.bold))
            Text(title)
                .font(.caption)
                .foregroundStyle(AppTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct OpportunityListWorkspaceView: View {
    let opportunities: [Opportunity]
    let onSelect: (Opportunity) -> Void
    var body: some View {
        VStack(spacing: 12) {
            ForEach(opportunities) { opp in
                Button(action: { onSelect(opp) }) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(opp.title).font(.headline)
                            Text(opp.companyName).font(.subheadline).foregroundStyle(AppTheme.mutedText)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(AppTheme.mutedText)
                    }
                    .padding()
                    .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 15))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct OpportunityDetailWorkspaceView: View {
    let opportunity: Opportunity
    let onBack: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button(action: onBack) {
                Label("All Recommendations", systemImage: "chevron.left")
                    .font(.caption.weight(.bold))
            }
            
            Text(opportunity.companyName)
                .font(.title.weight(.bold))
            
            Text(opportunity.summary)
                .foregroundStyle(AppTheme.mutedText)
            
            Button("Draft Outreach") { }
                .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct ContentListWorkspaceView: View {
    let items: [ContentItem]
    let onSelect: (ContentItem) -> Void
    var body: some View {
        VStack(spacing: 12) {
            ForEach(items) { item in
                Button(action: { onSelect(item) }) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.title).font(.headline)
                        Text(item.summary).lineLimit(2).font(.caption).foregroundStyle(AppTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 15))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct SettingsWorkspaceView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    var body: some View {
        VStack(spacing: 20) {
            Toggle("Continuous Voice Mode", isOn: $viewModel.isContinuousVoiceModeEnabled)
                .padding()
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 15))
            
            Button("Sign Out") { }
                .foregroundStyle(.red)
        }
    }
}
