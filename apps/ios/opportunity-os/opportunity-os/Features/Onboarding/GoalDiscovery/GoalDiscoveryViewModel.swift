import Foundation

@MainActor
final class GoalDiscoveryViewModel: ObservableObject {
    @Published var messages: [AssistantConversationMessage]
    @Published var transcript = ""
    @Published var errorMessage: String?
    @Published var inferredPlan: OnboardingPlan?
    @Published var voiceState: VoiceConversationState = .ready

    private let assistantConversationService: AssistantConversationServiceProtocol
    private let speechRecognitionService: SpeechRecognitionServiceProtocol
    private let speechSynthesisService: SpeechSynthesisServiceProtocol
    private let sessionManager: SessionManager

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

    let spokenIntroduction = "Hi, I’m your Opportunity OS assistant. I’m here to help you create momentum, whether you are pursuing a job, a contract, a client, or an important new conversation. Let’s start with what you want to make happen."

    init(
        assistantConversationService: AssistantConversationServiceProtocol,
        speechRecognitionService: SpeechRecognitionServiceProtocol,
        speechSynthesisService: SpeechSynthesisServiceProtocol,
        sessionManager: SessionManager
    ) {
        self.assistantConversationService = assistantConversationService
        self.speechRecognitionService = speechRecognitionService
        self.speechSynthesisService = speechSynthesisService
        self.sessionManager = sessionManager
        self.messages = [
            AssistantConversationMessage(
                role: .assistant,
                text: "Hi, I’m your Opportunity OS assistant. I’ll help you create momentum and shape the first real cycle with you. Start by telling me what you want to make happen."
            )
        ]
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
            await speechSynthesisService.speak(latestAssistantText, preference: sessionManager.voicePreference)
            voiceState = .ready
        }
    }

    func playIntroductionIfNeeded() {
        guard !hasPlayedIntroduction else { return }
        hasPlayedIntroduction = true

        Task {
            debugTrace("GoalDiscovery", "playing spoken introduction")
            voiceState = .speaking
            await speechSynthesisService.speak(spokenIntroduction, preference: introductionVoice)
            voiceState = .ready
            debugTrace("GoalDiscovery", "introduction finished; starting voice turn")
            beginVoiceConversationTurn()
        }
    }

    private func beginVoiceConversationTurn() {
        voiceTurnTask?.cancel()
        voiceTurnTask = Task {
            do {
                errorMessage = nil
                transcript = ""
                voiceState = .listening
                debugTrace("GoalDiscovery", "listening for onboarding utterance")
                let utterance = try await speechRecognitionService.listenForUtterance()
                let normalized = utterance.trimmingCharacters(in: .whitespacesAndNewlines)
                transcript = normalized
                debugTrace("GoalDiscovery", "captured utterance=\(normalized)")
                guard !normalized.isEmpty else {
                    debugTrace("GoalDiscovery", "utterance empty; returning to ready")
                    voiceState = .ready
                    return
                }
                voiceState = .thinking
                debugTrace("GoalDiscovery", "sending onboarding message to assistant")
                await processUserMessage(normalized)
            } catch {
                transcript = await speechRecognitionService.latestTranscript()
                errorMessage = error.localizedDescription
                debugTrace("GoalDiscovery", "listening failed error=\(error.localizedDescription), partialTranscript=\(transcript)")
                voiceState = .ready
            }
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

    private func processUserMessage(_ text: String) async {
        debugTrace("GoalDiscovery", "processing user message=\(text)")
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
            do {
                debugTrace("GoalDiscovery", "awaiting assistant response for message=\(text)")
                let reply = try await assistantConversationService.respond(
                    to: text,
                    sessionId: assistantSessionId,
                    history: conversationHistory,
                    context: assistantContext
                )

                guard !Task.isCancelled else { return }

                assistantSessionId = reply.sessionId
                updateAssistantMessage(id: messageId, text: reply.text)
                debugTrace("GoalDiscovery", "assistant reply received sessionId=\(reply.sessionId ?? "nil"), text=\(reply.text.prefix(160))")
                debugTrace("GoalDiscovery", "speaking assistant reply")
                await speechSynthesisService.speak(reply.text, preference: sessionManager.voicePreference)
                debugTrace("GoalDiscovery", "finished speaking assistant reply")
            } catch {
                errorMessage = error.localizedDescription
                let fallbackReply = localFallbackReply()
                updateAssistantMessage(id: messageId, text: fallbackReply)
                debugTrace("GoalDiscovery", "assistant request failed error=\(error.localizedDescription); using fallback reply")
                await speechSynthesisService.speak(fallbackReply, preference: sessionManager.voicePreference)
            }

            guard !Task.isCancelled else { return }

            inferredPlan = buildPlan(from: userMessages)
            debugTrace("GoalDiscovery", "post-response canContinue=\(canContinue), userMessageCount=\(userMessages.count)")
            if canContinue {
                voiceState = .ready
            } else {
                voiceState = .ready
                beginVoiceConversationTurn()
            }
        }
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

    private var assistantContext: AssistantConversationContext {
        AssistantConversationContext(
            workspaceState: "onboarding_goal_discovery",
            nextAction: nil,
            opportunity: nil,
            contentItem: nil
        )
    }

    private func buildPlan(from userMessages: [String]) -> OnboardingPlan? {
        let combined = userMessages.joined(separator: " ").lowercased()
        guard !combined.isEmpty else { return nil }

        let opportunityType: String
        let focusArea: String
        let targetAudience: String

        if combined.contains("job") || combined.contains("role") || combined.contains("hire") {
            opportunityType = "job opportunities"
            focusArea = "positioning you for a role with a sharper story"
            targetAudience = audienceMatch(in: combined, fallback: "hiring managers and team leaders")
        } else if combined.contains("contract") || combined.contains("fractional") || combined.contains("project") {
            opportunityType = "contract opportunities"
            focusArea = "turning your experience into a targeted contract offer"
            targetAudience = audienceMatch(in: combined, fallback: "buyers who can sponsor contract work")
        } else if combined.contains("client") || combined.contains("consult") || combined.contains("service") {
            opportunityType = "consulting clients"
            focusArea = "shaping your service into a credible first outreach motion"
            targetAudience = audienceMatch(in: combined, fallback: "decision-makers who can buy advisory or delivery work")
        } else if combined.contains("partner") {
            opportunityType = "partnership conversations"
            focusArea = "creating a partner-ready narrative and first target list"
            targetAudience = audienceMatch(in: combined, fallback: "partners who can open new distribution or delivery paths")
        } else {
            opportunityType = "outbound opportunities"
            focusArea = "clarifying your offer and turning it into a practical first move"
            targetAudience = audienceMatch(in: combined, fallback: "people who can say yes to the next conversation")
        }

        let specialty = specialtyMatch(in: combined)
        let firstCycleTitle = "First cycle: \(specialty) outreach"
        let summary = "You are looking for \(opportunityType) and the strongest immediate move is \(focusArea)."
        let confirmation = "It sounds like your first goal is to create \(opportunityType) through a focused first cycle aimed at \(targetAudience)."

        return OnboardingPlan(
            focusArea: specialty,
            opportunityType: opportunityType,
            targetAudience: targetAudience,
            firstCycleTitle: firstCycleTitle,
            assistantSummary: summary,
            confirmationMessage: confirmation,
            firstCycleSteps: [
                "Confirm your offer in one sentence",
                "Pick the first target set: \(targetAudience)",
                "Draft the first message together"
            ],
            firstDraftPrompt: "Draft a first outreach message for \(targetAudience) around \(specialty)."
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
}
