import AVFoundation
import Foundation

struct SessionMessage: Identifiable, Hashable {
    enum Role: Hashable {
        case assistant
        case user
    }

    let id: UUID
    let role: Role
    var text: String

    init(id: UUID = UUID(), role: Role, text: String) {
        self.id = id
        self.role = role
        self.text = text
    }
}

enum SessionWorkspaceState: Hashable {
    case nextAction
    case discovery(ContentItem)
    case drafting(Opportunity)
    case draftReady(OutreachMessage)
    case completion(title: String, detail: String)
    case empty
}

enum VoiceConversationState: Hashable {
    case ready
    case listening
    case thinking
    case speaking
}

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var cycle = PreviewData.cycle
    @Published var opportunities: [Opportunity] = []
    @Published var contentItems: [ContentItem] = []
    @Published var followUps: [FollowUpItem] = []
    @Published var isSpeaking = false
    @Published var isListening = false
    @Published var hasLoaded = false
    @Published var nextAction: NextAction?
    @Published var nextActionOpportunity: Opportunity?
    @Published var workspaceState: SessionWorkspaceState = .nextAction
    @Published var messages: [SessionMessage] = []
    @Published var composerText = ""
    @Published var draftMessage: OutreachMessage?
    @Published var isLoadingDraft = false
    @Published var isExecutingWorkspaceAction = false
    @Published var errorMessage: String?
    @Published var transcript = ""
    @Published var voiceState: VoiceConversationState = .ready
    @Published var assistantSessionId: String?
    @Published var isContinuousVoiceModeEnabled = true

    private let opportunityService: OpportunityServiceProtocol
    private let nextActionService: NextActionServiceProtocol
    private let followUpService: FollowUpServiceProtocol
    private let contentDiscoveryService: ContentDiscoveryServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let assistantConversationService: AssistantConversationServiceProtocol
    private let messageDraftService: MessageDraftServiceProtocol
    private let emailService: EmailServiceProtocol
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
        self.sessionManager = sessionManager
    }

    func load() async {
        opportunities = await opportunityService.fetchRecommendedOpportunities()
        nextAction = await nextActionService.fetchTopNextAction()
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        followUps = await followUpService.fetchFollowUps()
        debugTrace(
            "HomeConversation",
            "load completed opportunities=\(opportunities.count), contentItems=\(contentItems.count), followUps=\(followUps.count), hasNextAction=\(nextAction != nil)"
        )

        if let action = nextAction {
            if let opportunityId = action.opportunityId {
                nextActionOpportunity = await opportunityService.fetchOpportunity(id: opportunityId)
                    ?? opportunities.first(where: { $0.id == opportunityId })
            }
            workspaceState = .nextAction
            messages = [
                SessionMessage(role: .assistant, text: assistantOpening(for: action))
            ]
        } else if let firstOpportunity = opportunities.first {
            nextActionOpportunity = firstOpportunity
            workspaceState = .nextAction
            messages = [
                SessionMessage(role: .assistant, text: "I found a live opportunity for \(firstOpportunity.companyName). We can draft outreach or inspect the context without leaving this screen.")
            ]
        } else {
            workspaceState = .empty
            messages = [
                SessionMessage(role: .assistant, text: "You’re connected and ready. Import content or open opportunity scan to start the next cycle.")
            ]
        }

        hasLoaded = true
        debugTrace(
            "HomeConversation",
            "home ready workspaceState=\(workspaceState), messageCount=\(messages.count), assistantSessionId=\(assistantSessionId ?? "nil")"
        )
    }

    func submitTextMessage() {
        let trimmed = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        composerText = ""
        Task {
            await processUserMessage(trimmed, shouldSpeakResponse: false)
        }
    }

    func speakLatestAssistantMessage() {
        guard let latestAssistantMessage = messages.last(where: { $0.role == .assistant }) else { return }

        Task {
            debugTrace("HomeConversation", "speaking latest assistant message text=\(latestAssistantMessage.text.prefix(160))")
            voiceState = .speaking
            isSpeaking = true
            await speechSynthesisService.speak(latestAssistantMessage.text, preference: sessionManager.voicePreference)
            isSpeaking = false
            voiceState = .ready
            debugTrace("HomeConversation", "finished speaking latest assistant message")
        }
    }

    func resetConversationSession() {
        voiceTurnTask?.cancel()
        assistantResponseTask?.cancel()
        assistantSessionId = nil
        transcript = ""
        composerText = ""
        errorMessage = nil
        isListening = false
        isSpeaking = false
        voiceState = .ready
        messages = [
            SessionMessage(role: .assistant, text: currentAssistantAnchorMessage)
        ]
        debugTrace("HomeConversation", "conversation session reset workspaceState=\(workspaceState), anchor=\(currentAssistantAnchorMessage.prefix(160))")
    }

    func toggleListening() {
        debugTrace("HomeConversation", "toggleListening state=\(voiceState)")
        switch voiceState {
        case .ready:
            beginVoiceConversationTurn()
        case .listening:
            return
        case .thinking:
            Task {
                await interruptConversationAndResumeListening()
            }
        case .speaking:
            Task {
                await interruptConversationAndResumeListening()
            }
        }
    }

    func setContinuousVoiceModeEnabled(_ isEnabled: Bool) {
        isContinuousVoiceModeEnabled = isEnabled
        debugTrace("HomeConversation", "continuousVoiceMode set enabled=\(isEnabled)")

        guard !isEnabled else { return }

        if voiceState == .speaking {
            Task {
                await speechSynthesisService.stopSpeaking()
                isSpeaking = false
                voiceState = .ready
            }
        }
    }

    func startPrimaryAction() {
        errorMessage = nil

        if shouldRouteToDiscovery {
            if let selectedContent = selectedContentItem {
                workspaceState = .discovery(selectedContent)
                messages.append(
                    SessionMessage(
                        role: .assistant,
                        text: "I’ve brought the discovery item into focus. Review it here, then generate outreach targets when you’re ready."
                    )
                )
            } else {
                workspaceState = .empty
            }
            return
        }

        if let opportunity = nextActionOpportunity ?? opportunities.first {
            Task {
                await beginDrafting(for: opportunity)
            }
            return
        }

        workspaceState = .empty
    }

    func openDiscoveryItem(_ item: ContentItem) {
        workspaceState = .discovery(item)
        messages.append(
            SessionMessage(
                role: .assistant,
                text: "This content looks leverageable. We can turn it into outreach targets from here."
            )
        )
    }

    func executeDiscoveryItem(_ item: ContentItem) {
        Task {
            isExecutingWorkspaceAction = true
            errorMessage = nil
            defer { isExecutingWorkspaceAction = false }

            do {
                let result = try await contentDiscoveryService.executeContent(itemId: item.id, maxTargets: 3)
                await refreshData()
                let targetSummary = result.targets.first.map { "\($0.fullName) at \($0.companyName)" } ?? "a new outreach target"
                workspaceState = .completion(
                    title: "Targets Generated",
                    detail: "I created \(result.targetCount) target\(result.targetCount == 1 ? "" : "s"), starting with \(targetSummary)."
                )
                messages.append(
                    SessionMessage(
                        role: .assistant,
                        text: "Done. I turned that discovery item into \(result.targetCount) outreach target\(result.targetCount == 1 ? "" : "s"). The next cycle is ready."
                    )
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func beginDrafting(for opportunity: Opportunity) async {
        isLoadingDraft = true
        errorMessage = nil
        workspaceState = .drafting(opportunity)
        defer { isLoadingDraft = false }

        let draft = await messageDraftService.generateDraft(for: opportunity)
        draftMessage = draft
        workspaceState = .draftReady(draft)
        messages.append(
            SessionMessage(
                role: .assistant,
                text: "I drafted outreach for \(opportunity.companyName). Review it below and send when it feels right."
            )
        )
    }

    func sendDraft() {
        guard let draftMessage else { return }

        Task {
            isExecutingWorkspaceAction = true
            errorMessage = nil
            defer { isExecutingWorkspaceAction = false }

            do {
                try await emailService.send(draftMessage)
                workspaceState = .completion(
                    title: "Outreach Sent",
                    detail: "I logged the send and advanced the cycle. We can move to the next recommendation whenever you’re ready."
                )
                messages.append(
                    SessionMessage(
                        role: .assistant,
                        text: "That’s sent. I’ve logged the activity and I’m ready to guide the next cycle."
                    )
                )
                await refreshData()
            } catch {
                errorMessage = "Send failed."
            }
        }
    }

    func resetToNextAction() {
        workspaceState = nextAction == nil && opportunities.isEmpty ? .empty : .nextAction
        draftMessage = nil
        errorMessage = nil
    }

    var shouldRouteToDiscovery: Bool {
        guard let nextAction else { return false }
        let recommendation = nextAction.recommendedAction.lowercased()
        return recommendation.contains("uploaded content")
            || recommendation.contains("generate outreach targets")
            || nextAction.title.lowercased().contains("leverage content")
    }

    var selectedContentItem: ContentItem? {
        contentItems.first
    }

    var currentWorkspaceTitle: String {
        switch workspaceState {
        case .nextAction:
            return nextAction?.title ?? "Next Action"
        case .discovery(let item):
            return item.title
        case .drafting(let opportunity):
            return "Preparing outreach for \(opportunity.companyName)"
        case .draftReady:
            return "Draft Ready"
        case .completion(let title, _):
            return title
        case .empty:
            return "Ready for the next cycle"
        }
    }

    private func refreshData() async {
        opportunities = await opportunityService.fetchRecommendedOpportunities()
        nextAction = await nextActionService.fetchTopNextAction()
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        followUps = await followUpService.fetchFollowUps()
        debugTrace(
            "HomeConversation",
            "refreshData completed opportunities=\(opportunities.count), contentItems=\(contentItems.count), followUps=\(followUps.count), hasNextAction=\(nextAction != nil)"
        )
    }

    private func beginVoiceConversationTurn() {
        voiceTurnTask?.cancel()
        debugTrace("HomeConversation", "beginVoiceConversationTurn requested")
        voiceTurnTask = Task {
            errorMessage = nil
            transcript = ""

            // Ensure audio session is properly reset before starting recording
            // This prevents conflicts when transitioning from speech synthesis (playback) to recognition (recording)
            await deactivateAudioSessionForRecording()

            voiceState = .listening
            isListening = true
            isSpeaking = false
            debugTrace("HomeConversation", "voice turn entered listening state")

            do {
                let utterance = try await speechRecognitionService.listenForUtterance()
                let normalizedUtterance = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                transcript = normalizedUtterance
                isListening = false
                debugTrace("HomeConversation", "🎤 VOICE PIPELINE: captured utterance=\"\(normalizedUtterance)\"")

                guard !normalizedUtterance.isEmpty else {
                    debugTrace("HomeConversation", "captured utterance was empty; returning to ready")
                    voiceState = .ready
                    // In continuous mode, restart listening even for empty utterances
                    if isContinuousVoiceModeEnabled {
                        debugTrace("HomeConversation", "continuous mode: restarting after empty utterance")
                        beginVoiceConversationTurn()
                    }
                    return
                }

                voiceState = .thinking
                debugTrace("HomeConversation", "transitioning to thinking for message=\(normalizedUtterance)")

                // Process the transcribed message and wait for completion
                // This will await the full assistant response including speech
                await processUserMessage(normalizedUtterance, shouldSpeakResponse: true)

                // Note: When continuous mode is enabled, the assistant response task
                // will have already restarted listening via beginVoiceConversationTurn()
                // before processUserMessage returns. If disabled, we simply stay in ready state.

            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                isListening = false
                voiceState = .ready
                debugTrace("HomeConversation", "voice turn failed error=\(error.localizedDescription), partialTranscript=\(transcript)")
                // In continuous mode, restart listening even after errors
                if isContinuousVoiceModeEnabled {
                    debugTrace("HomeConversation", "continuous mode: restarting after error")
                    beginVoiceConversationTurn()
                }
            }
        }
    }

    private func interruptConversationAndResumeListening() async {
        voiceTurnTask?.cancel()
        assistantResponseTask?.cancel()
        errorMessage = nil
        debugTrace("HomeConversation", "interrupting current conversation to resume listening")
        await speechSynthesisService.stopSpeaking()
        isSpeaking = false
        isListening = false
        voiceState = .ready
        beginVoiceConversationTurn()
    }

    private func deactivateAudioSessionForRecording() async {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            // Deactivate the current audio session (likely in playback mode from speech synthesis)
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
            debugTrace("HomeConversation", "audio session deactivated for transition to recording")
            // Small delay to ensure clean handoff
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        } catch {
            debugTrace("HomeConversation", "audio session deactivation warning (non-critical): \(error.localizedDescription)")
        }
    }

    private func assistantOpening(for action: NextAction) -> String {
        "I’ve surfaced the next best move: \(action.title). Stay here with me and I’ll help you execute it step by step."
    }

    private var currentAssistantAnchorMessage: String {
        switch workspaceState {
        case .nextAction:
            if let action = nextAction {
                return assistantOpening(for: action)
            }
            if let opportunity = nextActionOpportunity ?? opportunities.first {
                return "I found a live opportunity for \(opportunity.companyName). We can draft outreach or inspect the context without leaving this screen."
            }
            return "You’re connected and ready. Import content or open opportunity scan to start the next cycle."
        case .discovery(let item):
            return "We’re focused on \(item.title). I can help you review it and decide whether to generate outreach targets."
        case .drafting(let opportunity):
            return "I’m preparing outreach for \(opportunity.companyName) while staying here with you in the conversation."
        case .draftReady:
            return "The draft is ready. We can revise it together here or send it when it feels right."
        case .completion(_, let detail):
            return detail
        case .empty:
            return "You’re connected and ready. Import content or open opportunity scan to start the next cycle."
        }
    }

    private func processUserMessage(_ message: String, shouldSpeakResponse: Bool) async {
        debugTrace("HomeConversation", "🎯 FUNCTION ENTRY: processUserMessage called with message=\"\(message)\" shouldSpeak=\(shouldSpeakResponse)")
        debugTrace(
            "HomeConversation",
            "🎤 VOICE PIPELINE: processing user message shouldSpeak=\(shouldSpeakResponse) message=\"\(message)\""
        )
        messages.append(SessionMessage(role: .user, text: message))

        guard shouldSpeakResponse else {
            let response = await responseForUserMessage(message)
            messages.append(SessionMessage(role: .assistant, text: response))
            voiceState = .ready
            debugTrace("HomeConversation", "🎤 VOICE PIPELINE: non-voice response completed text=\"\(response.prefix(160))\"")
            return
        }

        let messageId = UUID()
        messages.append(SessionMessage(id: messageId, role: .assistant, text: ""))

        assistantResponseTask?.cancel()
        assistantResponseTask = Task {
            voiceState = .speaking
            isSpeaking = true
            debugTrace("HomeConversation", "assistant response task started for messageId=\(messageId), continuousMode=\(isContinuousVoiceModeEnabled)")
            do {
                let response = try await streamAssistantResponse(
                    for: message,
                    messageId: messageId
                )

                guard !Task.isCancelled else {
                    debugTrace("HomeConversation", "assistant response cancelled after stream")
                    return
                }

                // Wait for any remaining speech to complete before transitioning state
                await speechSynthesisService.waitForSpeechQueue()

                guard !Task.isCancelled else {
                    debugTrace("HomeConversation", "assistant response cancelled after speech")
                    return
                }

                isSpeaking = false
                voiceState = .ready
                debugTrace("HomeConversation", "streamed response completed text=\(response.prefix(160)), continuousMode=\(isContinuousVoiceModeEnabled)")

                if isContinuousVoiceModeEnabled {
                    debugTrace("HomeConversation", "🔄 CONTINUOUS MODE: restarting listening after streamed response")
                    beginVoiceConversationTurn()
                } else {
                    debugTrace("HomeConversation", "continuous mode disabled; staying in ready state")
                }
            } catch {
                let response = await responseForUserMessage(message)
                updateAssistantMessage(id: messageId, text: response)
                debugTrace("HomeConversation", "streaming failed; fallback response text=\(response.prefix(160))")

                guard !Task.isCancelled else { return }

                await speechSynthesisService.speak(
                    response,
                    preference: sessionManager.voicePreference
                )

                guard !Task.isCancelled else { return }

                isSpeaking = false
                voiceState = .ready

                if isContinuousVoiceModeEnabled {
                    debugTrace("HomeConversation", "🔄 CONTINUOUS MODE: restarting listening after fallback response")
                    beginVoiceConversationTurn()
                }
            }
        }

        // CRITICAL: Wait for the assistant response to complete before returning
        // This ensures continuous mode properly chains the conversation
        await assistantResponseTask?.value
        debugTrace("HomeConversation", "processUserMessage completed after awaiting assistant response")
    }

    private func updateAssistantMessage(id: UUID, text: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].text = text
        debugTrace("HomeConversation", "assistant message updated messageId=\(id), text=\(text.prefix(160))")
    }

    private func responseForUserMessage(_ message: String) async -> String {
        debugTrace("HomeConversation", "🎯 FUNCTION ENTRY: responseForUserMessage called with message=\"\(message)\"")
        do {
            debugTrace("HomeConversation", "requesting non-streaming response sessionId=\(assistantSessionId ?? "nil"), historyCount=\(conversationHistory.count)")
            let reply = try await assistantConversationService.respond(
                to: message,
                sessionId: assistantSessionId,
                history: conversationHistory,
                context: assistantContext
            )
            assistantSessionId = reply.sessionId
            debugTrace("HomeConversation", "non-streaming response received sessionId=\(reply.sessionId ?? "nil"), text=\(reply.text.prefix(160))")
            return reply.text
        } catch {
            errorMessage = error.localizedDescription
            debugTrace("HomeConversation", "non-streaming response failed error=\(error.localizedDescription)")
            return localFallbackResponse(for: message)
        }
    }

    private func streamAssistantResponse(
        for message: String,
        messageId: UUID
    ) async throws -> String {
        let stream = try assistantConversationService.streamResponse(
            to: message,
            sessionId: assistantSessionId,
            history: conversationHistory,
            context: assistantContext
        )
        debugTrace("HomeConversation", "streamAssistantResponse opened sessionId=\(assistantSessionId ?? "nil"), historyCount=\(conversationHistory.count)")

        var accumulated = ""
        var pendingSpeechBuffer = ""

        for try await chunk in stream {
            if Task.isCancelled {
                debugTrace("HomeConversation", "streamAssistantResponse cancelled after accumulated=\(accumulated.prefix(160))")
                return accumulated
            }

            switch chunk.kind {
            case .session:
                if let sessionId = chunk.sessionId {
                    assistantSessionId = sessionId
                    debugTrace("HomeConversation", "stream session established sessionId=\(sessionId)")
                }
            case .textDelta:
                if let text = chunk.text {
                    accumulated += text
                    let trimmedAccumulated = accumulated.trimmingCharacters(in: .whitespacesAndNewlines)
                    updateAssistantMessage(id: messageId, text: trimmedAccumulated)
                    debugTrace("HomeConversation", "stream text delta=\(text.prefix(160))")

                    pendingSpeechBuffer += text
                    let speakableSegments = drainSpeakableSegments(from: &pendingSpeechBuffer)
                    for segment in speakableSegments {
                        debugTrace("HomeConversation", "enqueueing streamed speech segment=\(segment.prefix(160))")
                        await speechSynthesisService.enqueueSpeech(
                            segment,
                            preference: sessionManager.voicePreference
                        )
                    }
                }
            case .done:
                if let sessionId = chunk.sessionId {
                    assistantSessionId = sessionId
                    debugTrace("HomeConversation", "stream done sessionId=\(sessionId)")
                }
                if let fullReply = chunk.fullReply, !fullReply.isEmpty {
                    accumulated = fullReply
                    updateAssistantMessage(id: messageId, text: fullReply)
                    debugTrace("HomeConversation", "stream done fullReply=\(fullReply.prefix(160))")
                    if pendingSpeechBuffer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        pendingSpeechBuffer = ""
                    }
                }
            }
        }

        let trailingSegment = pendingSpeechBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trailingSegment.isEmpty {
            debugTrace("HomeConversation", "enqueueing trailing speech segment=\(trailingSegment.prefix(160))")
            await speechSynthesisService.enqueueSpeech(
                trailingSegment,
                preference: sessionManager.voicePreference
            )
        }

        debugTrace("HomeConversation", "waiting for speech queue after streamed response")
        await speechSynthesisService.waitForSpeechQueue()

        debugTrace("HomeConversation", "streamAssistantResponse finished accumulated=\(accumulated.prefix(160))")
        return accumulated.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func drainSpeakableSegments(from buffer: inout String) -> [String] {
        var segments: [String] = []

        while let punctuationRange = buffer.rangeOfCharacter(from: CharacterSet(charactersIn: ".!?")) {
            let endIndex = buffer.index(after: punctuationRange.lowerBound)
            let segment = String(buffer[..<endIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !segment.isEmpty {
                segments.append(segment)
            }
            buffer = String(buffer[endIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let softLimit = 72
        if segments.isEmpty, buffer.count >= softLimit, let splitIndex = buffer.lastIndex(of: " ") {
            let prefix = String(buffer[..<splitIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !prefix.isEmpty {
                segments.append(prefix)
                buffer = String(buffer[splitIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        return segments
    }

    private var conversationHistory: [AssistantConversationMessage] {
        messages.map { message in
            AssistantConversationMessage(
                role: message.role == .assistant ? .assistant : .user,
                text: message.text
            )
        }
    }

    private var assistantContext: AssistantConversationContext {
        AssistantConversationContext(
            workspaceState: workspaceStateLabel,
            nextAction: nextAction,
            opportunity: activeOpportunity,
            contentItem: activeContentItem
        )
    }

    private var activeOpportunity: Opportunity? {
        switch workspaceState {
        case .drafting(let opportunity):
            return opportunity
        case .nextAction, .draftReady, .completion, .empty:
            return nextActionOpportunity ?? opportunities.first
        case .discovery:
            return nextActionOpportunity ?? opportunities.first
        }
    }

    private var activeContentItem: ContentItem? {
        switch workspaceState {
        case .discovery(let item):
            return item
        default:
            return selectedContentItem
        }
    }

    private var workspaceStateLabel: String {
        switch workspaceState {
        case .nextAction:
            return "next_action"
        case .discovery:
            return "discovery"
        case .drafting:
            return "drafting"
        case .draftReady:
            return "draft_ready"
        case .completion:
            return "completion"
        case .empty:
            return "empty"
        }
    }

    private func localFallbackResponse(for message: String) -> String {
        let lowered = message.lowercased()

        if lowered.contains("why") {
            return nextAction?.reason ?? "This is the best available move based on the current opportunity and discovery context."
        }

        if lowered.contains("next") || lowered.contains("what should i do") {
            if let title = nextAction?.title {
                return "The next move is \(title)."
            }
            return "The next move is to import content or scan for opportunities."
        }

        if lowered.contains("call") {
            return "I’m not running the live call stack yet, but this session model is ready for pre-call brief, call initiation, and post-call debrief to live right here."
        }

        if lowered.contains("draft") {
            return "I can prepare the draft in this workspace so you don’t have to leave the assistant flow."
        }

        return "I’m keeping the current cycle in focus. If you want, I can explain the recommendation, open discovery context, or prepare the draft here."
    }
}
