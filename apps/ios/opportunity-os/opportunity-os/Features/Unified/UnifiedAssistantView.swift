import AVFoundation
import Foundation
import SwiftUI
import MessageUI

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
    
    // Pro States (inherited from Home)
    case nextAction
    case discovery(ContentItem)
    case drafting(Opportunity)
    case draftReady(OutreachMessage)
    case completion(title: String, detail: String)
    case empty
}

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
    private let sessionManager: SessionManager
    
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
        sessionManager: SessionManager
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
        
        setupInitialState()
    }
    
    private func setupInitialState() {
        if sessionManager.isAuthenticated {
            sessionMode = .pro
            workspaceState = .nextAction
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
        
        if let action = nextAction {
            workspaceState = .nextAction
            if messages.isEmpty {
                messages = [SessionMessage(role: .assistant, text: "I’ve surfaced the next best move: \(action.title). Stay here with me and I’ll help you execute it step by step.")]
            }
        } else {
            workspaceState = .empty
        }
    }
    
    // MARK: - Voice Interaction Logic (Unified)
    
    func toggleListening() {
        debugTrace("UnifiedAssistant", "toggleListening state=\(voiceState)")
        switch voiceState {
        case .ready:
            beginVoiceConversationTurn()
        case .listening:
            return
        case .thinking, .speaking:
            Task {
                await interruptConversationAndResumeListening()
            }
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
                
                // Unified Intent Detection
                if isPauseCommand(normalized) {
                    beginVoiceConversationTurn()
                    return
                }
                
                if isFinishOnboardingCommand(normalized) {
                    handleFinishOnboardingRequest()
                    return
                }
                
                if isSendEmailCommand(normalized) {
                    handleSendEmailRequest()
                    return
                }
                
                voiceState = .thinking
                await processUserMessage(normalized, shouldSpeakResponse: true)
                
            } catch {
                errorMessage = error.localizedDescription
                voiceState = .ready
                if isContinuousVoiceModeEnabled { beginVoiceConversationTurn() }
            }
        }
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
        
        // Update onboarding plan if in discovery
        if case .onboarding(.discovery) = sessionMode {
            updateOnboardingPlan()
        }
        
        let messageId = UUID()
        messages.append(SessionMessage(id: messageId, role: .assistant, text: "..."))
        
        assistantResponseTask = Task {
            voiceState = .speaking
            do {
                // Determine context based on unified state
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
                
                if isContinuousVoiceModeEnabled {
                    beginVoiceConversationTurn()
                }
            } catch {
                errorMessage = error.localizedDescription
                updateAssistantMessage(id: messageId, text: "I'm having trouble connecting right now.")
                voiceState = .ready
            }
        }
        await assistantResponseTask?.value
    }
    
    // MARK: - Intent Handlers
    
    private func handleFinishOnboardingRequest() {
        guard case .onboarding = sessionMode else { return }
        
        if let plan = onboardingPlan {
            withAnimation {
                sessionMode = .onboarding(.identityRequest)
                workspaceState = .onboardingIdentity
            }
            Task {
                await processUserMessage("[SYSTEM]: User is ready to create their account and finish setup.", shouldSpeakResponse: true)
            }
        } else {
            Task {
                await processUserMessage("I'm ready to start", shouldSpeakResponse: true)
            }
        }
    }
    
    private func handleSendEmailRequest() {
        if let draft = buildDraftFromConversation() {
            pendingEmailDraft = draft
            Task {
                await speechSynthesisService.speak("Opening that draft for you now.", preference: sessionManager.voicePreference)
            }
        }
    }
    
    func handleMailResult(_ result: MFMailComposeResult, for draft: OutreachMessage) {
        pendingEmailDraft = nil
        if result == .sent {
            messages.append(SessionMessage(role: .assistant, text: "Email sent to \(draft.recipients.first?.name ?? "the contact")."))
            Task {
                try? await emailService.send(draft)
                await processUserMessage("[SYSTEM]: User successfully sent the email draft.", shouldSpeakResponse: true)
            }
        } else {
            beginVoiceConversationTurn()
        }
    }
    
    // MARK: - Identity Flow
    
    func signUp() {
        guard !onboardingEmail.isEmpty && !onboardingPassword.isEmpty else { return }
        
        isExecutingAction = true
        Task {
            do {
                let session = try await authService.signUp(email: onboardingEmail, password: onboardingPassword)
                sessionManager.start(session: session)
                
                withAnimation {
                    sessionMode = .pro
                    workspaceState = .nextAction
                }
                await loadProData()
                
                messages.append(SessionMessage(role: .assistant, text: "Account created! You're all set. I've loaded your first cycle and I'm ready to keep going."))
                await processUserMessage("[SYSTEM]: User successfully signed up and is now in Pro mode.", shouldSpeakResponse: true)
                
            } catch {
                errorMessage = "Failed to create account: \(error.localizedDescription)"
            }
            isExecutingAction = false
        }
    }
    
    // MARK: - Helpers (Drafts, Plans, Commands)
    
    private func updateOnboardingPlan() {
        let userTexts = messages.filter { $0.role == .user }.map(\.text)
        let combined = userTexts.joined(separator: " ").lowercased()
        // Simplistic logic for demonstration, real one would be more robust
        if combined.contains("job") || combined.contains("role") {
            onboardingPlan = OnboardingPlan(
                focusArea: "Job Search",
                opportunityType: "roles",
                targetAudience: "Hiring Managers",
                firstCycleTitle: "First Cycle",
                assistantSummary: "Finding roles",
                confirmationMessage: "Let's find some roles.",
                firstCycleSteps: ["Step 1"],
                firstDraftPrompt: "Draft an email"
            )
        }
    }
    
    private func buildAssistantContext() -> AssistantConversationContext {
        let workspaceLabel: String
        switch workspaceState {
        case .onboardingIntro: workspaceLabel = "onboarding_intro"
        case .onboardingDiscovery: workspaceLabel = "onboarding_discovery"
        case .onboardingIdentity: workspaceLabel = "onboarding_identity"
        case .nextAction: workspaceLabel = "next_action"
        case .discovery: workspaceLabel = "discovery"
        case .drafting: workspaceLabel = "drafting"
        case .draftReady: workspaceLabel = "draft_ready"
        case .completion: workspaceLabel = "completion"
        case .empty: workspaceLabel = "empty"
        }
        
        return AssistantConversationContext(
            workspaceState: workspaceLabel,
            nextAction: nextAction,
            opportunity: nil,
            contentItem: nil
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
    
    private func isPauseCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        return lower.contains("wait") || lower.contains("be quiet") || lower.contains("listen to me")
    }
    
    private func isFinishOnboardingCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        return lower.contains("create account") || lower.contains("sign up") || lower.contains("ready to start")
    }
    
    private func isSendEmailCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        return lower.contains("send email") || lower.contains("draft email")
    }
    
    private func buildDraftFromConversation() -> OutreachMessage? {
        // Placeholder logic to bridge to existing draft services
        return nil
    }
}

struct UnifiedAssistantView: View {
    @StateObject var viewModel: UnifiedAssistantViewModel
    
    var body: some View {
        ZStack {
            AppTheme.pageBackground.ignoresSafeArea()
            
            VStack(spacing: 0) {
                header
                
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: 24) {
                            voiceHeroRegion
                            transcriptRegion
                            contextualWorkspaceRegion
                        }
                        .padding(20)
                    }
                }
            }
        }
        .sheet(item: $viewModel.pendingEmailDraft) { draft in
            MailComposeView(
                subject: draft.subject,
                body: draft.body,
                recipients: draft.recipients.compactMap(\.email),
                onDismiss: { result in
                    viewModel.handleMailResult(result, for: draft)
                }
            )
        }
    }
    
    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Opportunity OS")
                    .font(.title2.weight(.bold))
                Text(modeSubtitle)
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedText)
            }
            Spacer()
            if case .pro = viewModel.sessionMode {
                Button(action: {}) {
                    Image(systemName: "slider.horizontal.3")
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(AppTheme.surface.opacity(0.8))
    }
    
    private var voiceHeroRegion: some View {
        VStack(spacing: 20) {
            Button(action: viewModel.toggleListening) {
                VoiceOrbView(isListening: viewModel.voiceState != .ready, pulse: true)
                    .frame(width: 200, height: 200)
            }
            .buttonStyle(.plain)
            
            Text(orbCaption)
                .font(.headline)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(30)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 30))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 20, y: 10)
    }
    
    private var transcriptRegion: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Conversation", systemImage: "text.bubble")
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.accent)
            
            VStack(alignment: .leading, spacing: 12) {
                ForEach(viewModel.messages.suffix(3)) { message in
                    HStack {
                        if message.role == .user { Spacer() }
                        Text(message.text)
                            .padding(12)
                            .background(message.role == .assistant ? AppTheme.accentSoft : AppTheme.accent, in: RoundedRectangle(cornerRadius: 15))
                            .foregroundStyle(message.role == .assistant ? AppTheme.primaryText : .white)
                        if message.role == .assistant { Spacer() }
                    }
                }
            }
        }
        .padding(20)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 25))
        .overlay(RoundedRectangle(cornerRadius: 25).stroke(AppTheme.border))
    }
    
    private var contextualWorkspaceRegion: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(workspaceTitle)
                .font(.headline)
            
            workspaceContent
        }
        .padding(22)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 30))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 15, y: 5)
    }
    
    @ViewBuilder
    private var workspaceContent: some View {
        switch viewModel.workspaceState {
        case .onboardingIntro:
            Text("Tell me what you're looking for, and I'll build your first outreach strategy.")
                .foregroundStyle(AppTheme.mutedText)
            Button("Start Talking") { viewModel.toggleListening() }
                .buttonStyle(.borderedProminent)
            
        case .onboardingIdentity:
            VStack(spacing: 12) {
                TextField("Email", text: $viewModel.onboardingEmail)
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $viewModel.onboardingPassword)
                    .textFieldStyle(.roundedBorder)
                Button("Create My Account") { viewModel.signUp() }
                    .buttonStyle(.borderedProminent)
            }
            
        case .nextAction:
            if let action = viewModel.nextAction {
                Text(action.title)
                    .font(.title3.weight(.bold))
                Text(action.reason)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
            }
            
        default:
            Text("Ready for the next move.")
                .foregroundStyle(AppTheme.mutedText)
        }
    }
    
    private var modeSubtitle: String {
        switch viewModel.sessionMode {
        case .onboarding: return "Onboarding Session"
        case .pro: return "Pro Assistant"
        }
    }
    
    private var orbCaption: String {
        switch viewModel.voiceState {
        case .ready: return "Tap to talk"
        case .listening: return "I'm listening..."
        case .thinking: return "Thinking..."
        case .speaking: return "Speaking..."
        }
    }
    
    private var workspaceTitle: String {
        switch viewModel.workspaceState {
        case .onboardingIntro: return "Welcome"
        case .onboardingDiscovery: return "Finding Your Goal"
        case .onboardingIdentity: return "Secure Your Progress"
        default: return "Current Action"
        }
    }
}
