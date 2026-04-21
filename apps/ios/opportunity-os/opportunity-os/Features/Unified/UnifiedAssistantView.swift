import AVFoundation
import Foundation
import SwiftUI
import Combine
import MessageUI

// MARK: - Global Assistant Shell Models

enum StrategicLifecycle: Hashable {
    case discovery
    case strategy
    case operations
}

enum UnifiedWorkspaceState: Hashable {
    // Onboarding States
    case discoveryIntro
    case discoveryActive
    case identityRequest
    
    // Pro Workspace States
    case dashboard              // Overview of momentum and next steps
    case campaignFocus(Campaign)// Specific campaign details
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
    @Published var lifecycle: StrategicLifecycle = .discovery
    @Published var workspaceState: UnifiedWorkspaceState = .discoveryIntro
    
    // Voice & Chat State
    @Published var messages: [SessionMessage] = []
    @Published var isPendingModalPresentation = false // Blocks voice while modal is animating in
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
    @Published var activeGoal: Goal?
    @Published var activeCampaigns: [Campaign] = []
    @Published var selectedCampaign: Campaign?
    @Published var isLoading = false
    @Published var isExecutingAction = false
    
    // Onboarding specific
    @Published var strategicPlan: StrategicPlan?
    @Published var onboardingEmail = ""
    @Published var onboardingPassword = ""
    @Published var showingConfirmationModal = false
    @Published var inferredPlan: StrategicPlan?
    @Published var isLoadingPlan = false
    @Published var currentSuggestedAction: String?
    private var pendingAssistantMessageId: UUID?
    
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
    private let strategyService: StrategyServiceProtocol
    private let goalService: GoalServiceProtocol
    private let campaignService: CampaignServiceProtocol
    private let debugService: RemoteDebugServiceProtocol
    private let assistantSocketService: AssistantSocketService
    private let voicePreferenceService: VoicePreferenceServiceProtocol
    private let activityService: ActivityServiceProtocol
    private let taskService: TaskServiceProtocol
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
        strategyService: StrategyServiceProtocol,
        goalService: GoalServiceProtocol,
        campaignService: CampaignServiceProtocol,
        debugService: RemoteDebugServiceProtocol,
        voicePreferenceService: VoicePreferenceServiceProtocol,
        assistantSocketService: AssistantSocketService,
        sessionManager: SessionManager,
        apiClient: OpportunityOSAPIClient,
        activityService: ActivityServiceProtocol,
        taskService: TaskServiceProtocol
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
        self.strategyService = strategyService
        self.goalService = goalService
        self.campaignService = campaignService
        self.debugService = debugService
        self.voicePreferenceService = voicePreferenceService
        self.assistantSocketService = assistantSocketService
        self.sessionManager = sessionManager
        self.apiClient = apiClient
        self.activityService = activityService
        self.taskService = taskService
        
        setupSocketSubscriptions()
        setupInitialState()
    }
    
    private var socketCancellables = Set<AnyCancellable>()
    
    private func setupSocketSubscriptions() {
        assistantSocketService.textPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] chunk in
                guard let self = self, let messageId = self.pendingAssistantMessageId else { return }
                self.appendAssistantMessagePartial(id: messageId, delta: chunk)
            }
            .store(in: &socketCancellables)
            
        assistantSocketService.audioPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] data in
                guard let self = self else { return }
                
                // If this is the start of a speaking turn, we MUST stop listening first
                if self.voiceState != .speaking {
                    self.voiceState = .speaking
                    Task {
                        // Hard wait for mic to stop before allowing ANY audio
                        await self.speechRecognitionService.stopListening()
                        self.speechSynthesisService.playRawAudio(data)
                    }
                } else {
                    // Subsequent chunks play immediately
                    self.speechSynthesisService.playRawAudio(data)
                }
            }
            .store(in: &socketCancellables)
            
        assistantSocketService.eventPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handleAssistantEvent(event)
            }
            .store(in: &socketCancellables)
    }
    
    private func handleAssistantEvent(_ event: AssistantEvent) {
        switch event {
        case .sessionStarted(let sid):
            self.assistantSessionId = sid
        case .uiSignal(let name):
            if name == "PROPOSE_GOAL_SIGNAL" {
                // Pre-signal, could show loading or specific animation
            }
        case .done(let reply, let action, let plan):
            debugTrace("UnifiedAssistant", "✅ .done received: action=\(action ?? "nil") hasPlan=\(plan != nil) replyLen=\(reply.count)")
            if let lastId = pendingAssistantMessageId, let index = messages.firstIndex(where: { $0.id == lastId }) {
                messages[index].text = reply
                pendingAssistantMessageId = nil
            } else {
                self.messages.append(SessionMessage(role: .assistant, text: reply))
            }
            
            if let action = action, let plan = plan {
                self.currentSuggestedAction = action
                self.inferredPlan = plan
                
                if action == "PROPOSE_GOAL" {
                    debugTrace("UnifiedAssistant", "🎯 PROPOSE_GOAL: showing modal immediately")
                    self.showingConfirmationModal = true
                } else if action == "PROPOSE_CAMPAIGN" {
                    debugTrace("UnifiedAssistant", "⚔️ PROPOSE_CAMPAIGN: locking voice, starting speech-wait task")
                    self.isPendingModalPresentation = true
                    
                    Task {
                        debugTrace("UnifiedAssistant", "⚔️ PROPOSE_CAMPAIGN: waiting 0.5s for TTS to start")
                        try? await Task.sleep(nanoseconds: 500_000_000)
                        
                        var pollCount = 0
                        while self.speechSynthesisService.isSpeaking {
                            pollCount += 1
                            try? await Task.sleep(nanoseconds: 200_000_000)
                        }
                        debugTrace("UnifiedAssistant", "⚔️ PROPOSE_CAMPAIGN: TTS finished after \(pollCount) polls, waiting 0.3s buffer")
                        
                        try? await Task.sleep(nanoseconds: 300_000_000)
                        
                        await MainActor.run {
                            debugTrace("UnifiedAssistant", "⚔️ PROPOSE_CAMPAIGN: showing campaign modal, clearing isPendingModalPresentation")
                            withAnimation(.spring()) {
                                self.showingConfirmationModal = true
                                self.isPendingModalPresentation = false
                            }
                        }
                    }
                }
            } else {
                debugTrace("UnifiedAssistant", "ℹ️ .done: no action/plan in this turn")
            }
            
            let isModalBlocking = self.showingConfirmationModal || self.isPendingModalPresentation
            debugTrace("UnifiedAssistant", "🔒 voice guard: continuousMode=\(isContinuousVoiceModeEnabled) modalBlocking=\(isModalBlocking) (showingModal=\(self.showingConfirmationModal) pendingModal=\(self.isPendingModalPresentation))")
            
            if isContinuousVoiceModeEnabled && !isModalBlocking {
                let waitAndResume = { [weak self] in
                    if self?.speechSynthesisService.isSpeaking == true {
                        debugTrace("UnifiedAssistant", "🎤 TTS still active, deferring voice turn 0.5s")
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            self?.beginVoiceConversationTurn()
                        }
                    } else {
                        debugTrace("UnifiedAssistant", "🎤 TTS idle, starting voice turn now")
                        self?.beginVoiceConversationTurn()
                    }
                }
                waitAndResume()
            } else {
                debugTrace("UnifiedAssistant", "🔇 voice suppressed: modal active or pending")
                self.voiceState = .ready
            }
        }
    }
    
    private func setupInitialState() {
        assistantSocketService.connect()
        if sessionManager.isAuthenticated {
            lifecycle = .operations
            workspaceState = .dashboard
            Task { await loadProData() }
        } else {
            lifecycle = .discovery
            workspaceState = .discoveryIntro
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
        activeGoal = await goalService.fetchActiveGoal()
        activeCampaigns = await campaignService.fetchCampaigns()
        
        if workspaceState == .discoveryIntro || workspaceState == .identityRequest {
            workspaceState = .dashboard
        }
    }
    
    // MARK: - Voice Interaction Logic
    
    func toggleListening() {
        if workspaceState == .discoveryIntro {
            withAnimation {
                workspaceState = .discoveryActive
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
    
    func beginVoiceConversationTurn() {
        debugTrace("UnifiedAssistant", "🎤 VOICE TURN: Requesting new turn. continuousMode=\(isContinuousVoiceModeEnabled)")
        voiceTurnTask?.cancel()
        voiceTurnTask = Task {
            errorMessage = nil
            transcript = ""
            
            // Small delay to allow audio session category to switch from playback to recording
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
            
            await MainActor.run {
                self.voiceState = .listening
            }
            debugTrace("UnifiedAssistant", "🎤 VOICE TURN: State set to .listening, calling speechRecognitionService.listenForUtterance()")
            
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
                // Note: We no longer call beginVoiceConversationTurn() here.
                // It is now called inside handleAssistantEvent(.done) to ensure the AI has finished its turn.
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
    
    private func processUserMessage(_ text: String, shouldSpeakResponse: Bool, isSystemMessage: Bool = false) async {
        // System messages are invisible in the chat UI but still drive the AI
        if isSystemMessage {
            messages.append(SessionMessage(role: .system, text: text))
        } else {
            messages.append(SessionMessage(role: .user, text: text))
        }
        
        let messageId = UUID()
        pendingAssistantMessageId = messageId
        // Only show assistant placeholder bubble for non-system messages (system turns speak without a visible bubble until done)
        if !isSystemMessage {
            messages.append(SessionMessage(id: messageId, role: .assistant, text: ""))
        } else {
            messages.append(SessionMessage(id: messageId, role: .assistant, text: ""))
        }
        
        voiceState = .thinking
        
        // Ensure socket is connected
        if assistantSocketService.state != .connected {
            debugTrace("UnifiedAssistant", "🔌 Socket not connected, attempting to connect before converse...")
            assistantSocketService.connect()
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1s
        }
        
        let context = buildAssistantContext()
        assistantSocketService.converse(
            message: text,
            sessionId: assistantSessionId,
            guestSessionId: sessionManager.guestSessionId,
            history: conversationHistory,
            context: context,
            userId: sessionManager.session?.user.id.uuidString
        )
    }
    
    private func appendAssistantMessagePartial(id: UUID, delta: String) {
        if let index = messages.firstIndex(where: { $0.id == id }) {
            var msg = messages[index]
            msg.text += delta
            messages[index] = msg
        }
    }
    
    // MARK: - Identity & Auth
    
    func signUp() {
        guard !onboardingEmail.isEmpty && !onboardingPassword.isEmpty else { return }
        isExecutingAction = true
        Task {
            do {
                let session = try await authService.signUp(email: onboardingEmail, password: onboardingPassword, guestSessionId: sessionManager.guestSessionId)
                sessionManager.start(session: session)
                
                // If we have a pending draft, return to it so the user can finish the action
                if pendingEmailDraft != nil {
                    withAnimation {
                        lifecycle = .operations
                        workspaceState = .outreachDrafting
                    }
                } else {
                    withAnimation {
                        lifecycle = .operations
                        workspaceState = .dashboard
                    }
                }
                
                await loadProData()
                messages.append(SessionMessage(role: .assistant, text: "Account secured! You can now continue with your outreach."))
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
    
    func focusCampaign(_ campaign: Campaign) {
        withAnimation {
            selectedCampaign = campaign
            workspaceState = .campaignFocus(campaign)
        }
    }

    func startPrimaryAction() {
        guard let action = nextAction else { return }
        
        if let opportunityId = action.opportunityId, 
           let opportunity = opportunities.first(where: { $0.id == opportunityId }) {
            if action.recommendedAction.lowercased().contains("draft") {
                Task { await beginDrafting(for: opportunity) }
            } else {
                focusOpportunity(opportunity)
            }
        } else if let opportunity = opportunities.first {
            if action.recommendedAction.lowercased().contains("draft") {
                Task { await beginDrafting(for: opportunity) }
            } else {
                focusOpportunity(opportunity)
            }
        }
    }

    func beginDrafting(for opportunity: Opportunity) async {
        isExecutingAction = true
        defer { isExecutingAction = false }
        
        let draft = await messageDraftService.generateDraft(for: opportunity)
        pendingEmailDraft = draft
        withAnimation {
            workspaceState = .outreachDrafting
        }
    }
    
    func sendDraft() {
        guard let draft = pendingEmailDraft else { return }
        
        // IDENTITY GATE: Must be logged in to send
        if sessionManager.session == nil {
            withAnimation {
                workspaceState = .identityRequest
            }
            return
        }
        
        isExecutingAction = true
        Task {
            do {
                try await emailService.send(draft)
                messages.append(SessionMessage(role: .assistant, text: "Email sent! I've updated the cycle status."))
                withAnimation { workspaceState = .dashboard }
                await loadProData()
            } catch {
                errorMessage = "Failed to send email: \(error.localizedDescription)"
            }
            isExecutingAction = false
        }
    }
    
    func loadPlanAndShowModal() async {
        guard !showingConfirmationModal else { return }
        guard let sessionId = assistantSessionId else { return }
        isLoadingPlan = true
        debugService.log("previewStrategicPlan starting for sessionId: \(sessionId)")
        do {
            let result = try await strategyService.previewStrategicPlan(sessionId: sessionId)
            debugService.log("previewStrategicPlan result: \(result.success)")
            if result.success {
                self.inferredPlan = result.toStrategicPlan()
                self.showingConfirmationModal = true
                debugService.log("showingConfirmationModal set to true")
            }
        } catch {
            debugService.log("finalizeStrategicGoal failed: \(error)")
        }
        isLoadingPlan = false
    }
    
    func finalizeStrategicGoalFromBackend() async {
        guard let sessionId = assistantSessionId else { return }
        
        // Hard stop transcription and clear any zombie audio buffer
        speechRecognitionService.stopTranscription()
        voiceTurnTask?.cancel()
        voiceTurnTask = nil
        
        await MainActor.run {
            self.voiceState = .ready // Neutralize before speaking
        }
        
        isLoadingPlan = true
        do {
            let result = try await strategyService.finalizeStrategicGoal(sessionId: sessionId)
            if result.success {
                self.inferredPlan = result.toStrategicPlan()
                
                // 1. Transition UI lifecycle
                await MainActor.run {
                    withAnimation(.spring()) {
                        self.lifecycle = .operations
                    }
                }
                
                // 2. Load fresh data so we know what prospects exist
                await loadProData()
                
                // 3. Build a context-aware nudge based on what we actually found
                Task {
                    // Brief pause for DB propagation
                    try? await Task.sleep(nanoseconds: 1_200_000_000) // 1.2s
                    
                    let prospectCount = self.opportunities.count
                    let nudge: String
                    
                    if prospectCount > 0 {
                        let names = self.opportunities.prefix(3).compactMap { $0.companyName }.joined(separator: ", ")
                        nudge = "Goal confirmed. I've already found \(prospectCount) potential prospects for you — including \(names.isEmpty ? "several matching contacts" : names). Now let's talk about how you want to approach outreach. What kind of campaign are you thinking — email, LinkedIn, or both?"
                    } else {
                        nudge = "Goal confirmed. Now let's plan how to go after it. I'm thinking we start with a targeted email campaign — I'll identify the right people to reach out to. Want me to propose a specific outreach plan?"
                    }
                    
                    await processUserMessage(nudge, shouldSpeakResponse: true, isSystemMessage: true)
                }
            }
        } catch {
            errorMessage = "Failed to finalize: \(error.localizedDescription)"
        }
        isLoadingPlan = false
    }

    func confirmCampaignFromBackend() async {
        guard let goalId = activeGoal?.id else {
            errorMessage = "No active goal found to attach campaign to."
            return
        }
        guard let plan = inferredPlan else { return }
        
        // Kill the ear before the mouth speaks
        speechRecognitionService.stopTranscription()
        voiceTurnTask?.cancel()
        voiceTurnTask = nil
        
        isLoadingPlan = true
        do {
            // Load fresh prospects now that the campaign is locked in
            await loadProData()
            
            await MainActor.run {
                self.currentSuggestedAction = nil
            }
            
            // Give the AI a context-rich message with actual prospect names
            Task {
                let prospectCount = self.opportunities.count
                let nudge: String
                
                if prospectCount > 0 {
                    let names = self.opportunities.prefix(3).compactMap { $0.companyName }.joined(separator: ", ")
                    nudge = "Campaign confirmed. I've identified \(prospectCount) targets for this outreach — \(names.isEmpty ? "strong prospects" : names). Who do you want to start with first?"
                } else {
                    nudge = "Campaign is locked in. I'm searching for the best people to contact. Who would you like to start with — direct hiring managers or recruiters at these firms?"
                }
                
                await processUserMessage(nudge, shouldSpeakResponse: true, isSystemMessage: true)
            }
        } catch {
            errorMessage = "Failed to confirm campaign: \(error.localizedDescription)"
        }
        isLoadingPlan = false
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
            messages.append(SessionMessage(role: .assistant, text: "Email sent! I've logged the outreach."))
            
            Task {
                // 1. Log the activity in the background
                let opportunityId = activeOpportunity?.id.uuidString
                let companyId: String? = nil // company ID not directly available on Opportunity model
                try? await activityService.logEmailSent(
                    opportunityId: opportunityId,
                    companyId: companyId,
                    subject: draft.subject,
                    bodySummary: String(draft.body.prefix(200))
                )
                
                // 2. Update opportunity stage to outreach_sent
                if let opp = activeOpportunity {
                    debugTrace("UnifiedAssistant", "📧 Logged email activity for opportunity=\(opp.id)")
                }
                
                // 3. Tell the AI what happened so it can naturally offer a follow-up
                let companyName = activeOpportunity?.companyName ?? "the contact"
                await processUserMessage(
                    "[SYSTEM]: Email to \(companyName) was sent successfully. Offer to set a follow-up reminder in 5 business days. Keep it brief.",
                    shouldSpeakResponse: true,
                    isSystemMessage: true
                )
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
        messages
            .filter { $0.role != .system } // System messages drive AI but aren't part of visible history
            .map { AssistantConversationMessage(role: $0.role == .assistant ? .assistant : .user, text: $0.text) }
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
        .overlay {
            if viewModel.showingConfirmationModal, let plan = viewModel.inferredPlan {
                ZStack {
                    Color.black.opacity(0.4)
                        .ignoresSafeArea()
                        .onTapGesture {
                            debugTrace("UnifiedAssistant", "🚪 Modal dismissed (backdrop tap)")
                            viewModel.showingConfirmationModal = false
                            if viewModel.isContinuousVoiceModeEnabled {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                    viewModel.beginVoiceConversationTurn()
                                }
                            }
                        }
                    
                    StrategicProposalModal(
                        plan: plan,
                        mode: viewModel.currentSuggestedAction == "PROPOSE_CAMPAIGN" ? .campaign : .goal,
                        titleOverride: viewModel.currentSuggestedAction == "PROPOSE_CAMPAIGN" ? "⚔️ Strategic Campaign" : nil,
                        confirmButtonLabel: viewModel.currentSuggestedAction == "PROPOSE_CAMPAIGN" ? "Confirm Strategy" : "Confirm & Set Goal",
                        onConfirm: {
                            if viewModel.currentSuggestedAction == "PROPOSE_CAMPAIGN" {
                                await viewModel.confirmCampaignFromBackend()
                            } else {
                                await viewModel.finalizeStrategicGoalFromBackend()
                            }
                        },
                        onDismiss: {
                            debugTrace("UnifiedAssistant", "🚪 Modal dismissed (user tapped X)")
                            viewModel.showingConfirmationModal = false
                            if viewModel.isContinuousVoiceModeEnabled {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                    viewModel.beginVoiceConversationTurn()
                                }
                            }
                        },
                        onNavigateToDashboard: {
                            viewModel.showingConfirmationModal = false
                            withAnimation { viewModel.workspaceState = .dashboard }
                        }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.spring(response: 0.4, dampingFraction: 0.8), value: viewModel.showingConfirmationModal)
            }
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
        case .discoveryIntro:
            OnboardingIntroView(onStart: { viewModel.toggleListening() })
            
        case .discoveryActive:
            DiscoveryOnboardingWorkspaceView(viewModel: viewModel)
            
        case .identityRequest:
            IdentitySetupView(
                email: $viewModel.onboardingEmail, 
                password: $viewModel.onboardingPassword, 
                onSignUp: { viewModel.signUp() },
                onCancel: { viewModel.workspaceState = .dashboard }
            )
            
        case .dashboard:
            DashboardWorkspaceView(viewModel: viewModel)
            
        case .campaignFocus(let campaign):
            CampaignDetailWorkspaceView(viewModel: viewModel, campaign: campaign, onBack: { viewModel.workspaceState = .dashboard })
            
        case .opportunityList:
            OpportunityListWorkspaceView(opportunities: viewModel.opportunities, onSelect: { viewModel.focusOpportunity($0) })
            
        case .opportunityFocus:
            if let opp = viewModel.activeOpportunity {
                OpportunityDetailWorkspaceView(opportunity: opp, onBack: { viewModel.workspaceState = .opportunityList })
            }
            
        case .discoveryInventory:
            ContentListWorkspaceView(items: viewModel.contentItems, onSelect: { viewModel.focusContent($0) })
            
        case .outreachDrafting:
            if let draft = viewModel.pendingEmailDraft {
                OutreachDraftingWorkspaceView(draft: draft, onSend: { viewModel.sendDraft() }, onCancel: { viewModel.workspaceState = .dashboard })
            }
            
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
                        ForEach(messages.filter { $0.role != .system }) { message in
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
        switch viewModel.lifecycle {
        case .discovery: return "Discovery Mode"
        case .strategy: return "Strategy Lab"
        case .operations: return "Pro Mode"
        }
    }
    
    private var workspaceTitle: String {
        switch viewModel.workspaceState {
        case .discoveryIntro: return "Welcome"
        case .discoveryActive: return "Discovery"
        case .identityRequest: return "Identity"
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
    let onCancel: () -> Void
    var body: some View {
        VStack(spacing: 16) {
            Text("Secure Your Progress")
                .font(.headline)
            Text("Sign up to save your goals and start sending outreach.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
                .multilineTextAlignment(.center)
            
            TextField("Email Address", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("Create Password", text: $password)
                .textFieldStyle(.roundedBorder)
            
            VStack(spacing: 8) {
                Button("Secure My Account", action: onSignUp)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                
                Button("Maybe Later") {
                    withAnimation { onCancel() }
                }
                .buttonStyle(.plain)
                .foregroundStyle(AppTheme.mutedText)
                .padding(.top, 4)
            }
        }
        .padding(24)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct DashboardWorkspaceView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                // 1. Top Level: The North Star (Goal)
                if let goal = viewModel.activeGoal {
                    ActiveGoalCard(goal: goal)
                } else {
                    ActiveGoalCard(goal: Goal(id: UUID(), title: "Setting your first goal...", status: .active))
                        .redacted(reason: .placeholder)
                }
                
                // 2. Mid Level: Strategic Vehicles (Campaigns)
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("Active Campaigns")
                            .font(.headline)
                        Spacer()
                        Button("View All") {
                            withAnimation { viewModel.workspaceState = .discoveryInventory }
                        }
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                    }
                    .padding(.horizontal)
                    
                    if viewModel.activeCampaigns.isEmpty {
                        Text("No active campaigns yet. Talk to me to start one.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
                            .padding(.horizontal)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                ForEach(viewModel.activeCampaigns) { campaign in
                                    Button(action: { viewModel.focusCampaign(campaign) }) {
                                        CampaignCard(campaign: campaign)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                
                // 3. Tactical Execution (Action Level)
                if let action = viewModel.nextAction {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Next Best Move")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 12) {
                                Circle()
                                    .fill(AppTheme.accentSoft)
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Image(systemName: "bolt.fill")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(AppTheme.accent)
                                    )
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(action.title)
                                        .font(.headline)
                                    Text(action.reason)
                                        .font(.subheadline)
                                        .foregroundStyle(AppTheme.mutedText)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            
                            Button(action: { viewModel.startPrimaryAction() }) {
                                Text(action.recommendedAction)
                                    .font(.subheadline.weight(.bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(AppTheme.accent, in: RoundedRectangle(cornerRadius: 12))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding()
                        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 24))
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(AppTheme.border.opacity(0.5), lineWidth: 1)
                        )
                        .padding(.horizontal)
                    }
                }
                
                // 4. Bottom Level: The Pipeline (Counts)
                VStack(alignment: .leading, spacing: 16) {
                    Text("Your Pipeline")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    HStack(spacing: 16) {
                        MetricCard(title: "Opportunities", value: "\(viewModel.opportunities.count)", icon: "target")
                        MetricCard(title: "Discovery", value: "\(viewModel.contentItems.count)", icon: "doc.text.magnifyingglass")
                    }
                    .padding(.horizontal)
                }
                
                Spacer(minLength: 40)
            }
            .padding(.vertical)
        }
    }
}

struct ActiveGoalCard: View {
    let goal: Goal
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("CURRENT GOAL")
                    .font(.system(size: 10, weight: .black))
                    .tracking(1.5)
                    .foregroundStyle(AppTheme.accent)
                Spacer()
                Image(systemName: "star.fill")
                    .font(.caption)
                    .foregroundStyle(AppTheme.accent)
            }
            
            Text(goal.title)
                .font(.title2.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            
            if let desc = goal.description {
                Text(desc)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedText)
                    .lineLimit(2)
            }
            
            HStack {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                Text("Active Strategy")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.mutedText)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                AppTheme.surface
                LinearGradient(colors: [AppTheme.accent.opacity(0.12), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .overlay(
            RoundedRectangle(cornerRadius: 28)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .padding(.horizontal)
    }
}

struct CampaignCard: View {
    let campaign: Campaign
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "chart.bar.fill")
                .font(.title3)
                .foregroundStyle(AppTheme.accent)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(campaign.title)
                    .font(.headline)
                    .lineLimit(1)
                Text(campaign.strategicAngle ?? "No angle defined")
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedText)
                    .lineLimit(2)
            }
            
            Spacer()
            
            HStack {
                Text("ACTIVE")
                    .font(.system(size: 8, weight: .black))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppTheme.accentSoft, in: Capsule())
                    .foregroundStyle(AppTheme.accent)
                Spacer()
            }
        }
        .padding()
        .frame(width: 160, height: 180, alignment: .leading)
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(AppTheme.border.opacity(0.5), lineWidth: 1)
        )
    }
}

// MARK: - Campaign Detail View

struct CampaignDetailWorkspaceView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    let campaign: Campaign
    let onBack: () -> Void
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                Button(action: onBack) {
                    Label("Back to Dashboard", systemImage: "chevron.left")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                }
                .padding(.horizontal)
                
                VStack(alignment: .leading, spacing: 12) {
                    Text("Campaign")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(AppTheme.accent)
                    
                    Text(campaign.title)
                        .font(.title.weight(.bold))
                    
                    HStack {
                        Text(campaign.status.rawValue.uppercased())
                            .font(.system(size: 10, weight: .black))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(AppTheme.accentSoft, in: Capsule())
                            .foregroundStyle(AppTheme.accent)
                        Spacer()
                    }
                }
                .padding(.horizontal)
                
                VStack(alignment: .leading, spacing: 16) {
                    DetailSection(title: "Strategic Angle", content: campaign.strategicAngle ?? "No angle defined.")
                    DetailSection(title: "Target Segment", content: campaign.targetSegment ?? "No target segment defined.")
                }
                .padding()
                .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 24))
                .padding(.horizontal)
                
                // Add Opportunities list for this campaign
                VStack(alignment: .leading, spacing: 16) {
                    Text("Opportunities in this Campaign")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    let campaignOpportunities = viewModel.opportunities.filter { $0.campaignId == campaign.id }
                    
                    if campaignOpportunities.isEmpty {
                        Text("No opportunities linked to this campaign yet.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
                            .padding(.horizontal)
                    } else {
                        VStack(spacing: 12) {
                            ForEach(campaignOpportunities) { opp in
                                Button(action: { viewModel.focusOpportunity(opp) }) {
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text(opp.title).font(.subheadline.weight(.bold))
                                            Text(opp.companyName).font(.caption).foregroundStyle(AppTheme.mutedText)
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
                        .padding(.horizontal)
                    }
                }
                
                Spacer(minLength: 40)
            }
            .padding(.vertical)
        }
    }
}

struct OutreachDraftingWorkspaceView: View {
    let draft: OutreachMessage
    let onSend: () -> Void
    let onCancel: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Review Draft")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 12) {
                Text(draft.subject)
                    .font(.subheadline.weight(.bold))
                    .padding(.bottom, 4)
                
                Text(draft.body)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.primaryText)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(AppTheme.border.opacity(0.5), lineWidth: 1)
            )
            
            HStack(spacing: 16) {
                Button(action: onSend) {
                    Text("Send Now")
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.accent, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                
                Button(action: onCancel) {
                    Text("Cancel")
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.border, lineWidth: 1))
                }
            }
        }
        .padding()
    }
}

struct DetailSection: View {
    let title: String
    let content: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.mutedText)
            Text(content)
                .font(.subheadline)
                .foregroundStyle(AppTheme.primaryText)
                .fixedSize(horizontal: false, vertical: true)
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
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 24))
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(AppTheme.border.opacity(0.5), lineWidth: 1)
        )
        .shadow(color: AppTheme.shadow.opacity(0.05), radius: 10, y: 5)
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
