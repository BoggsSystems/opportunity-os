import Foundation
import MessageUI

@MainActor
final class GoalDiscoveryViewModel: ObservableObject {
    @Published var messages: [AssistantConversationMessage]
    @Published var transcript = ""
    @Published var errorMessage: String?
    @Published var inferredPlan: OnboardingPlan?
    @Published var voiceState: VoiceConversationState = .ready
    @Published var pendingEmailDraft: OutreachMessage?
    @Published var isLoading = false
    @Published var showingConfirmationModal = false
    
    var onFinishRequest: ((OnboardingPlan) -> Void)?

    private let assistantConversationService: AssistantConversationServiceProtocol
    private var speechRecognitionService: SpeechRecognitionServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let emailService: EmailServiceProtocol
    private let sessionManager: SessionManager
    private let onboardingService: OnboardingServiceProtocol

    private var assistantSessionId: String?
    private var hasPlayedIntroduction = false
    private var voiceTurnTask: Task<Void, Never>?
    private var assistantResponseTask: Task<Void, Never>?

    private let introductionVoice = VoicePreference(
        styleDescription: "Warm introduction voice with calm confidence",
        localeIdentifier: "en-AU",
        displayName: "Guide",
        speakingRate: 0.45,
        prefersVoiceInput: true
    )

    let spokenIntroduction = "Hi, I'm your Opportunity OS assistant. What do you want to make happen?"

    init(
        assistantConversationService: AssistantConversationServiceProtocol,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        emailService: EmailServiceProtocol,
        sessionManager: SessionManager,
        onboardingService: OnboardingServiceProtocol
    ) {
        self.assistantConversationService = assistantConversationService
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
        self.emailService = emailService
        self.sessionManager = sessionManager
        self.onboardingService = onboardingService
        self.messages = [
            AssistantConversationMessage(
                role: .assistant,
                text: "Hi, I'm your Opportunity OS assistant. I'll help you create momentum and shape your first cycle. What do you want to make happen?"
            )
        ]

        // Log which services are being used
        let isStubAI = type(of: assistantConversationService) == StubAssistantConversationService.self
        debugTrace("GoalDiscovery", "🚨 INIT: assistantConversationService type=\(type(of: assistantConversationService)), isStub=\(isStubAI)")
        debugTrace("GoalDiscovery", "🚨 INIT: speechRecognitionService type=\(type(of: speechRecognitionService))")
        debugTrace("GoalDiscovery", "🚨 INIT: speechSynthesisService type=\(type(of: speechSynthesisService))")
        if isStubAI {
            debugTrace("GoalDiscovery", "⚠️ WARNING: Using STUB AI service - responses will be canned, not from backend!")
        } else {
            debugTrace("GoalDiscovery", "✅ Using REAL AI service - responses will come from backend API")
        }
        
        self.speechRecognitionService.onSpeechDetected = { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                debugTrace("GoalDiscovery", "barge-in detected: stopping speech synthesis")
                await self.speechSynthesisService.stopSpeaking()
                if self.voiceState == .speaking {
                    self.voiceState = .listening
                }
            }
        }
    }

    var canContinue: Bool {
        inferredPlan != nil && userMessages.count > 0
    }

    var latestAssistantMessage: String? {
        messages.last(where: { $0.role == .assistant })?.text
    }

    var recentMessages: [AssistantConversationMessage] {
        Array(messages.suffix(4))
    }

    func toggleListening() {
        debugTrace("GoalDiscovery", "toggleListening state=\(voiceState)")
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

    func speakLatestAssistantMessage() {
        guard let latestAssistantText = latestAssistantMessage else { return }

        Task {
            voiceState = .speaking
            #if targetEnvironment(simulator)
            await speechSynthesisService.speak(latestAssistantText, preference: sessionManager.voicePreference)
            if !Task.isCancelled && voiceState == .speaking {
                voiceState = .listening
            }
            beginVoiceConversationTurn(isConcurrentWithSpeech: false)
            #else
            beginVoiceConversationTurn(isConcurrentWithSpeech: true)
            speechRecognitionService.activeSynthesizedText = latestAssistantText
            await speechSynthesisService.speak(latestAssistantText, preference: sessionManager.voicePreference)
            speechRecognitionService.activeSynthesizedText = nil
            if !Task.isCancelled && voiceState == .speaking {
                voiceState = .listening
            }
            #endif
        }
    }

    func playIntroductionIfNeeded() {
        guard !hasPlayedIntroduction else { return }
        hasPlayedIntroduction = true

        Task {
            debugTrace("GoalDiscovery", "playing spoken introduction")
            voiceState = .speaking
            #if targetEnvironment(simulator)
            await speechSynthesisService.speak(spokenIntroduction, preference: introductionVoice)
            debugTrace("GoalDiscovery", "introduction finished")
            if !Task.isCancelled && voiceState == .speaking {
                voiceState = .listening
            }
            beginVoiceConversationTurn(isConcurrentWithSpeech: false)
            #else
            beginVoiceConversationTurn(isConcurrentWithSpeech: true)
            speechRecognitionService.activeSynthesizedText = spokenIntroduction
            await speechSynthesisService.speak(spokenIntroduction, preference: introductionVoice)
            speechRecognitionService.activeSynthesizedText = nil
            debugTrace("GoalDiscovery", "introduction finished")
            if !Task.isCancelled && voiceState == .speaking {
                voiceState = .listening
            }
            #endif
        }
    }

    private func beginVoiceConversationTurn(isConcurrentWithSpeech: Bool = false) {
        voiceTurnTask?.cancel()
        debugTrace("GoalDiscovery", "🔍 DEBUG: beginVoiceConversationTurn START")
        voiceTurnTask = Task {
            do {
                errorMessage = nil
                transcript = ""
                if !isConcurrentWithSpeech {
                    voiceState = .listening
                    debugTrace("GoalDiscovery", "🔍 DEBUG: voiceState set to listening")
                } else {
                    debugTrace("GoalDiscovery", "🔍 DEBUG: listening concurrently with speech")
                }
                debugTrace("GoalDiscovery", "listening for onboarding utterance")
                let utterance = try await speechRecognitionService.listenForUtterance()
                let normalized = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                transcript = normalized
                debugTrace("GoalDiscovery", "🔍 DEBUG: captured utterance=\"\(normalized)\"")
                guard !normalized.isEmpty else {
                    debugTrace("GoalDiscovery", "utterance empty; returning to ready")
                    if voiceState == .listening {
                        voiceState = .ready
                    }
                    debugTrace("GoalDiscovery", "🔍 DEBUG: RESTARTING after empty utterance")
                    beginVoiceConversationTurn(isConcurrentWithSpeech: false) // Keep listening
                    return
                }
                
                if self.isPauseCommand(normalized) {
                    debugTrace("GoalDiscovery", "⏸️ PAUSE COMMAND DETECTED ('\(normalized)'). Continuing to listen without responding.")
                    if voiceState != .listening {
                        voiceState = .listening
                    }
                    beginVoiceConversationTurn(isConcurrentWithSpeech: false)
                    return
                }

                if self.isFinishOnboardingCommand(normalized) {
                    debugTrace("GoalDiscovery", "🏁 FINISH ONBOARDING intent detected ('\(normalized)')")
                    if let plan = buildPlan(from: userMessages) {
                        self.inferredPlan = plan
                        self.showingConfirmationModal = true
                    } else {
                        await self.loadPlanAndShowModal()
                    }
                    return
                }

                if self.isSendEmailCommand(normalized) {
                    debugTrace("GoalDiscovery", "📧 SEND EMAIL COMMAND DETECTED ('\(normalized)')")
                    if let draft = self.buildDraftFromConversation() {
                        self.pendingEmailDraft = draft
                        await speechSynthesisService.speak("Opening that up in your email now.", preference: sessionManager.voicePreference)
                    } else {
                        await speechSynthesisService.speak("I don't have a draft ready yet. Let's talk through what you want to send first.", preference: sessionManager.voicePreference)
                    }
                    if voiceState != .listening {
                        voiceState = .listening
                    }
                    beginVoiceConversationTurn(isConcurrentWithSpeech: false)
                    return
                }
                
                voiceState = .thinking
                debugTrace("GoalDiscovery", "🔍 DEBUG: voiceState set to thinking")
                debugTrace("GoalDiscovery", "sending onboarding message to assistant")
                await processUserMessage(normalized)
                debugTrace("GoalDiscovery", "🔍 DEBUG: processUserMessage completed, voiceState=\(voiceState)")
            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                debugTrace("GoalDiscovery", "🔍 DEBUG: listening FAILED error=\(error.localizedDescription)")
                debugTrace("GoalDiscovery", "listening failed error=\(error.localizedDescription), partialTranscript=\(transcript)")
                if voiceState == .listening {
                    voiceState = .ready
                }
                debugTrace("GoalDiscovery", "🔍 DEBUG: RESTARTING after error")
                beginVoiceConversationTurn(isConcurrentWithSpeech: false) // Keep listening even after errors
            }
            debugTrace("GoalDiscovery", "🔍 DEBUG: beginVoiceConversationTurn END")
        }
    }

    private func interruptConversationAndResumeListening() async {
        voiceTurnTask?.cancel()
        assistantResponseTask?.cancel()
        errorMessage = nil
        await speechSynthesisService.stopSpeaking()
        voiceState = .ready
        beginVoiceConversationTurn()
    }

    func handleMailResult(_ result: MFMailComposeResult, for draft: OutreachMessage) {
        pendingEmailDraft = nil
        debugTrace("GoalDiscovery", "📧 MAIL RESULT: \(result)")
        
        switch result {
        case .sent:
            // 1. Log visually in the chat
            let recipientName = draft.recipients.first?.name ?? "the contact"
            let confirmationText = "Email sent to \(recipientName)."
            messages.append(AssistantConversationMessage(role: .assistant, text: confirmationText))
            
            // 2. Persist to backend activity log
            Task {
                try? await emailService.send(draft)
                debugTrace("GoalDiscovery", "📧 Activity logged to backend for sent email")
            }
            
            // 3. Inform the AI to trigger the next conversational move
            Task {
                await processUserMessage("[SYSTEM]: User successfully sent the email draft to \(recipientName).")
            }
            
        case .cancelled, .saved, .failed:
            // Just resume listening if they cancelled or it failed
            beginVoiceConversationTurn(isConcurrentWithSpeech: false)
        @unknown default:
            beginVoiceConversationTurn(isConcurrentWithSpeech: false)
        }
    }

    private func processUserMessage(_ text: String) async {
        debugTrace("GoalDiscovery", "🔍 DEBUG: processUserMessage START text=\"\(text)\"")
        debugTrace("GoalDiscovery", "🔍 DEBUG: serviceType=\(type(of: assistantConversationService))")
        messages.append(AssistantConversationMessage(role: .user, text: text))
        inferredPlan = buildPlan(from: userMessages)
        if let inferredPlan {
            debugTrace("GoalDiscovery", "local plan inferred title=\(inferredPlan.firstCycleTitle), audience=\(inferredPlan.targetAudience)")
        } else {
            debugTrace("GoalDiscovery", "local plan inference still incomplete")
        }
        errorMessage = nil
        let messageId = UUID()
        messages.append(AssistantConversationMessage(role: .assistant, text: ""))

        assistantResponseTask?.cancel()
        assistantResponseTask = Task {
            voiceState = .speaking
            debugTrace("GoalDiscovery", "🔍 DEBUG: assistantResponseTask START messageId=\(messageId)")
            do {
                debugTrace("GoalDiscovery", "awaiting assistant stream for message=\(text)")
                let stream = try assistantConversationService.streamResponse(
                    to: text,
                    sessionId: assistantSessionId,
                    history: conversationHistory,
                    context: assistantContext
                )

                for try await chunk in stream {
                    guard !Task.isCancelled else { break }

                    switch chunk.kind {
                    case .session:
                        self.assistantSessionId = chunk.sessionId
                    case .textDelta:
                        if let delta = chunk.text {
                            self.appendAssistantMessage(id: messageId, delta: delta)
                        }
                    case .audioChunk:
                        if let audioBase64 = chunk.audioData, let audioData = Data(base64Encoded: audioBase64) {
                            #if targetEnvironment(simulator)
                            // Skip audio playback in simulator for speed
                            #else
                            // Requires updated SpeechSynthesisService
                            if let hybridService = self.speechSynthesisService as? HybridSpeechSynthesisService {
                                await hybridService.enqueueAudioData(audioData)
                            }
                            #endif
                        }
                    case .action:
                        if let action = chunk.action, action == "PROPOSE_GOAL" || action == "PROPOSE_CAMPAIGN" {
                            debugTrace("GoalDiscovery", "🚀 PROACTIVE TRIGGER: \(action) detected in stream")
                            Task {
                                await self.loadPlanAndShowModal()
                            }
                        }
                    case .done:
                        debugTrace("GoalDiscovery", "stream done. silent=\(chunk.shouldBeSilent)")
                        if chunk.shouldBeSilent {
                            self.voiceState = .listening
                            self.beginVoiceConversationTurn(isConcurrentWithSpeech: false)
                        } else {
                            #if targetEnvironment(simulator)
                            if self.voiceState == .speaking { self.voiceState = .listening }
                            self.beginVoiceConversationTurn(isConcurrentWithSpeech: false)
                            #else
                            self.beginVoiceConversationTurn(isConcurrentWithSpeech: true)
                            // Wait for audio queue to drain before listening again
                            if let hybridService = self.speechSynthesisService as? HybridSpeechSynthesisService {
                                await hybridService.waitForSpeechQueue()
                            }
                            self.debugTrace("GoalDiscovery", "finished speaking assistant stream")
                            if self.voiceState == .speaking { self.voiceState = .listening }
                            #endif
                        }
                    case .error:
                        self.errorMessage = chunk.errorMessage ?? "Unknown stream error"
                        self.appendAssistantMessage(id: messageId, delta: "\n[Error: \(self.errorMessage!)]")
                    }
                }
            } catch {
                errorMessage = error.localizedDescription
                let fallbackReply = localFallbackReply()
                updateAssistantMessage(id: messageId, text: fallbackReply)
                debugTrace("GoalDiscovery", "🔍 DEBUG: assistant request FAILED error=\(error.localizedDescription)")
                debugTrace("GoalDiscovery", "assistant request failed error=\(error.localizedDescription); using fallback reply")
                
                voiceState = .speaking
                #if targetEnvironment(simulator)
                await speechSynthesisService.speak(fallbackReply, preference: sessionManager.voicePreference)
                if voiceState == .speaking {
                    voiceState = .listening
                }
                beginVoiceConversationTurn(isConcurrentWithSpeech: false)
                #else
                beginVoiceConversationTurn(isConcurrentWithSpeech: true)
                speechRecognitionService.activeSynthesizedText = fallbackReply
                await speechSynthesisService.speak(fallbackReply, preference: sessionManager.voicePreference)
                speechRecognitionService.activeSynthesizedText = nil
                #endif
            }

            guard !Task.isCancelled else {
                debugTrace("GoalDiscovery", "🔍 DEBUG: assistantResponseTask CANCELLED before restart check")
                return
            }

            inferredPlan = buildPlan(from: userMessages)
            debugTrace("GoalDiscovery", "post-response canContinue=\(canContinue), userMessageCount=\(userMessages.count)")
            
            #if !targetEnvironment(simulator)
            if voiceState == .speaking {
                voiceState = .listening
            }
            #endif
            debugTrace("GoalDiscovery", "🔍 DEBUG: assistantResponseTask END")
        }

        // CRITICAL: Wait for the assistant response to complete before returning
        debugTrace("GoalDiscovery", "🔍 DEBUG: awaiting assistantResponseTask.value...")
        await assistantResponseTask?.value
        debugTrace("GoalDiscovery", "🔍 DEBUG: processUserMessage END (assistantResponseTask completed)")
    }

    private var userMessages: [String] {
        messages
            .filter { $0.role == .user }
            .map(\.text)
    }

    private var conversationHistory: [AssistantConversationMessage] {
        messages
    }

    private func updateAssistantMessage(id: UUID, text: String) {
        let assistantMessages = messages.indices.filter { messages[$0].role == .assistant }
        guard let index = assistantMessages.last else { return }
        messages[index].text = text
    }

    private func appendAssistantMessage(id: UUID, delta: String) {
        let assistantMessages = messages.indices.filter { messages[$0].role == .assistant }
        guard let index = assistantMessages.last else { return }
        messages[index].text += delta
    }

    private var assistantContext: AssistantConversationContext {
        AssistantConversationContext(
            workspaceState: "onboarding_goal_discovery",
            nextAction: nil,
            opportunity: nil,
            contentItem: nil
        )
    }

    /// Finalizes onboarding by calling the backend to extract goal from conversation
    func finalizeOnboardingFromBackend() async {
        guard let sessionId = assistantSessionId else {
            debugTrace("GoalDiscovery", "❌ Cannot finalize onboarding: no sessionId")
            errorMessage = "Session error. Please try again."
            return
        }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            debugTrace("GoalDiscovery", "🎯 Calling backend to finalize onboarding with sessionId=\(sessionId)")
            let result = try await onboardingService.finalizeOnboarding(sessionId: sessionId)
            
            guard result.success else {
                throw OnboardingError.serverError("Backend returned unsuccessful response")
            }
            
            let plan = result.toOnboardingPlan()
            self.inferredPlan = plan
            self.showingConfirmationModal = false
            
            debugTrace("GoalDiscovery", "✅ Onboarding finalized: Goal=\"\(result.goal.title)\", Campaign=\"\(result.campaign.title)\"")
            
            onFinishRequest?(plan)
        } catch {
            debugTrace("GoalDiscovery", "❌ Failed to finalize onboarding: \(error.localizedDescription)")
            
            // Fallback to local inference if backend fails
            debugTrace("GoalDiscovery", "⚠️ Falling back to local goal inference")
            if let plan = buildPlanFallback(from: self.userMessages) {
                self.inferredPlan = plan
                onFinishRequest?(plan)
            } else {
                errorMessage = "Failed to complete onboarding. Please try again."
                await speechSynthesisService.speak("I'm having trouble completing your setup. Let's try once more.", preference: sessionManager.voicePreference)
            }
        }
    }

    private func loadPlanAndShowModal() async {
        guard let sessionId = assistantSessionId else { return }
        isLoading = true
        do {
            debugTrace("GoalDiscovery", "🎯 Proactively loading plan for sessionId=\(sessionId)")
            let result = try await onboardingService.finalizeOnboarding(sessionId: sessionId)
            if result.success {
                self.inferredPlan = result.toOnboardingPlan()
                self.showingConfirmationModal = true
                debugTrace("GoalDiscovery", "✨ Proactive modal triggered for goal: \(result.goal.title)")
            }
        } catch {
            debugTrace("GoalDiscovery", "❌ Failed to load plan for proactive proposal: \(error.localizedDescription)")
        }
        isLoading = false
    }

    private func buildPlan(from userMessages: [String]) -> OnboardingPlan? {
        return buildPlanFallback(from: userMessages)
    }
    
    /// Fallback local goal inference (simplified version for resilience)
    private func buildPlanFallback(from userMessages: [String]) -> OnboardingPlan? {
        let combined = userMessages.joined(separator: " ").lowercased()
        guard !combined.isEmpty else { return nil }

        let opportunityType: String
        let focusArea: String
        let targetAudience: String

        if combined.contains("job") || combined.contains("role") || combined.contains("hire") {
            opportunityType = "job opportunities"
            focusArea = "positioning you for a role with a sharper story"
            targetAudience = "hiring managers and team leaders"
        } else if combined.contains("contract") || combined.contains("fractional") {
            opportunityType = "contract opportunities"
            focusArea = "turning your experience into a targeted contract offer"
            targetAudience = "buyers who can sponsor contract work"
        } else if combined.contains("client") || combined.contains("consult") {
            opportunityType = "consulting clients"
            focusArea = "shaping your service into a credible first outreach motion"
            targetAudience = "decision-makers who can buy advisory work"
        } else if combined.contains("partner") {
            opportunityType = "partnership conversations"
            focusArea = "creating a partner-ready narrative and first target list"
            targetAudience = "partners who can open new paths"
        } else {
            opportunityType = "outbound opportunities"
            focusArea = "clarifying your offer and turning it into a practical first move"
            targetAudience = "people who can say yes to the next conversation"
        }

        return OnboardingPlan(
            focusArea: "general",
            opportunityType: opportunityType,
            targetAudience: targetAudience,
            firstCycleTitle: "First cycle: \(opportunityType) outreach",
            assistantSummary: "You are looking for \(opportunityType).",
            confirmationMessage: "Let's create \(opportunityType) through focused outreach.",
            firstCycleSteps: ["Confirm your offer", "Pick first targets", "Draft your message"],
            firstDraftPrompt: "Draft a first outreach message for \(targetAudience)."
        )
    }

    private func audienceMatch(in text: String, fallback: String) -> String {
        if text.contains("cto") {
            return "CTOs and technical decision-makers"
        }
        if text.contains("founder") {
            return "founders and founding teams"
        }
        if text.contains("recruiter") {
            return "recruiters and hiring partners"
        }
        if text.contains("product") {
            return "product and technology leaders"
        }
        if text.contains("enterprise") {
            return "enterprise sponsors"
        }
        return fallback
    }

    private func specialtyMatch(in text: String) -> String {
        if text.contains("ai") {
            return "AI-focused"
        }
        if text.contains("software") || text.contains("engineering") {
            return "software leadership"
        }
        if text.contains("sales") {
            return "revenue"
        }
        if text.contains("design") {
            return "design-led"
        }
        return "goal-led"
    }

    private func localFallbackReply() -> String {
        guard let plan = inferredPlan else {
            return "I’m getting the shape of this. Tell me who you want to reach first and what kind of opportunity you want to create."
        }

        return "\(plan.confirmationMessage) We can use that to shape your account lightly and move straight into the first real cycle."
    }

    private func isPauseCommand(_ text: String) -> Bool {
        let cleaned = text.lowercased().components(separatedBy: .punctuationCharacters).joined().trimmingCharacters(in: .whitespacesAndNewlines)
        let pausePhrases: Set<String> = [
            "wait", "stop", "listen", "pause", "shh", "shhh", "listen to me",
            "hold on", "hang on", "hold up", "hold it",
            "wait a minute", "wait a second", "wait a sec",
            "hold on a minute", "hold on a second", "hold on a sec",
            "hang on a minute", "hang on a second", "hang on a sec",
            "one second", "one sec", "one minute",
            "give me a second", "give me a sec", "give me a minute",
            "give me a moment", "one moment", "just a moment", "just a second", "just a sec", "just a minute",
            "be quiet", "quiet"
        ]
        return pausePhrases.contains(cleaned)
    }

    private func isFinishOnboardingCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        return lower.contains("create account") || 
               lower.contains("create my account") || 
               lower.contains("finish setup") || 
               lower.contains("finish the setup") || 
               lower.contains("go to dashboard") ||
               lower.contains("ready to start") ||
               lower.contains("move on") ||
               lower.contains("let's start") ||
               lower.contains("let's go") ||
               lower.contains("sign up")
    }

    private func isSendEmailCommand(_ text: String) -> Bool {
        let lower = text.lowercased()
        let sendPhrases = [
            "send that email", "send the email", "send it", "send that",
            "go ahead and send", "send the draft", "send that draft",
            "send this email", "send this", "email that", "email it",
            "open in mail", "open it in mail", "open email",
            "fire it off", "shoot it over", "send it over", "send it off"
        ]
        return sendPhrases.contains(where: { lower.contains($0) })
    }

    /// Extracts a sendable draft from the conversation history.
    /// Looks for the last assistant message that appears to contain email content
    /// (has a greeting like "Hi" or "Dear" and substantive body text).
    private func buildDraftFromConversation() -> OutreachMessage? {
        // Find the last assistant message that looks like an email draft
        let assistantMessages = messages.filter { $0.role == .assistant }
        guard let draftMessage = assistantMessages.last(where: { msg in
            let lower = msg.text.lowercased()
            return lower.contains("hi ") || lower.contains("dear ") || lower.contains("hello ") ||
                   lower.contains("subject:") || lower.contains("hey ")
        }) else {
            return nil
        }

        // Try to extract subject from the text
        let lines = draftMessage.text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }
        var subject = "Outreach from Opportunity OS"
        var bodyLines: [String] = []
        var foundSubject = false

        for line in lines {
            if !foundSubject && line.lowercased().hasPrefix("subject:") {
                subject = String(line.dropFirst(8)).trimmingCharacters(in: .whitespaces)
                foundSubject = true
            } else {
                bodyLines.append(line)
            }
        }

        let body = bodyLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return nil }

        // Use recipients from the inferred plan context if available
        let recipient = Recipient(
            id: UUID(),
            name: inferredPlan?.targetAudience ?? "Recipient",
            organization: inferredPlan?.focusArea ?? "",
            email: nil, // User fills this in the mail composer
            role: "Contact"
        )

        return OutreachMessage(
            id: UUID(),
            subject: subject,
            body: body,
            recipients: [recipient],
            approvalRequired: false
        )
    }
}
