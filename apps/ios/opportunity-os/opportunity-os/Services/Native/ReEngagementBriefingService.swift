import Foundation

/// Aggregates data from multiple sources to build re-engagement briefings
@MainActor
struct ReEngagementBriefingService {
    private let opportunityService: OpportunityServiceProtocol
    private let nextActionService: NextActionServiceProtocol
    private let followUpService: FollowUpServiceProtocol
    private let campaignService: CampaignServiceProtocol
    
    init(
        opportunityService: OpportunityServiceProtocol,
        nextActionService: NextActionServiceProtocol,
        followUpService: FollowUpServiceProtocol,
        campaignService: CampaignServiceProtocol
    ) {
        self.opportunityService = opportunityService
        self.nextActionService = nextActionService
        self.followUpService = followUpService
        self.campaignService = campaignService
    }
    
    // MARK: - Tier 2: Session Break (Urgent Nudge)
    
    /// Fetches the single most urgent item for a session break nudge
    func fetchUrgentNudge() async -> UrgentNudge? {
        // Priority 1: Check for imminent follow-ups
        let followUps = await followUpService.fetchFollowUps()
        if let urgent = followUps.first(where: { $0.isDueSoon }) {
            return UrgentNudge(
                type: .followUp,
                title: "You have a follow-up due with \(urgent.recipientName) in \(urgent.timeUntilDueFormatted).",
                action: .viewFollowUp(id: urgent.id),
                priority: urgent.priority
            )
        }
        
        // Priority 2: Check for next actions
        if let nextAction = await nextActionService.fetchTopNextAction() {
            return UrgentNudge(
                type: .nextAction,
                title: nextAction.title,
                action: .viewOpportunity(id: nextAction.opportunityId),
                priority: .high
            )
        }
        
        return nil
    }
    
    // MARK: - Tier 3: Day Break (Morning Briefing)
    
    /// Fetches a comprehensive morning briefing
    func fetchMorningBriefing() async -> MorningBriefing? {
        async let opportunities = opportunityService.fetchRecommendedOpportunities()
        async let followUps = followUpService.fetchFollowUps()
        async let campaigns = campaignService.fetchCampaigns()
        
        let (ops, followUpsList, campaignsList) = await (opportunities, followUps, campaigns)
        
        // Find opportunities with new activity
        let activeOpportunities = ops.filter { $0.hasRecentActivity }
        let strongestLead = ops.max(by: { $0.momentumScore < $1.momentumScore })
        
        // Count campaign responses
        let newResponses = campaignsList.reduce(0) { $0 + $1.newResponseCount }
        
        // Count due follow-ups
        let dueToday = followUpsList.filter { $0.isDueToday }
        
        // Skip briefing if nothing notable happened
        if newResponses == 0 && dueToday.isEmpty && activeOpportunities.isEmpty {
            return nil
        }
        
        return MorningBriefing(
            newCampaignResponses: newResponses,
            followUpsDueToday: dueToday.count,
            strongestLead: strongestLead,
            activeOpportunities: activeOpportunities,
            campaignHighlights: campaignsList.filter { $0.newResponseCount > 0 }.map { $0.title }
        )
    }
    
    // MARK: - Tier 4: Extended Absence (Re-engagement Briefing)
    
    /// Fetches a comprehensive re-engagement briefing for extended absence
    func fetchReengagementBriefing(daysAway: Int) async -> ReengagementBriefing? {
        async let opportunities = opportunityService.fetchRecommendedOpportunities()
        async let followUps = followUpService.fetchFollowUps()
        async let campaigns = campaignService.fetchCampaigns()
        
        let (ops, followUpsList, campaignsList) = await (opportunities, followUps, campaigns)
        
        // Identify stale opportunities (no activity for days)
        let staleOpportunities = ops.filter { $0.daysSinceLastActivity > 3 }
        
        // Find opportunities at risk of going cold
        let atRisk = followUpsList.filter { $0.isAtRisk }
        
        // Calculate goal progress (mock for now - would need goals API)
        let goalProgress = GoalProgress(
            consultingGoal: calculateProgress(toward: 5, current: ops.filter { $0.type == .partnership && $0.cycleStatus == .inProgress }.count),
            recruiterGoal: calculateProgress(toward: 10, current: campaignsList.filter { $0.status == .active }.reduce(0) { $0 + $1.totalContacts })
        )
        
        // Find hottest leads
        let hotOpportunities = ops.filter { $0.momentumScore > 70 }.sorted { $0.momentumScore > $1.momentumScore }.prefix(3)
        
        return ReengagementBriefing(
            daysAway: daysAway,
            opportunitiesAtRisk: atRisk.count,
            staleOpportunities: staleOpportunities.count,
            hotOpportunities: Array(hotOpportunities),
            goalProgress: goalProgress,
            newResponses: campaignsList.reduce(0) { $0 + $1.newResponseCount },
            requiresAttention: !atRisk.isEmpty || !staleOpportunities.isEmpty
        )
    }
    
    private func calculateProgress(toward target: Int, current: Int) -> Double {
        guard target > 0 else { return 0 }
        return min(Double(current) / Double(target), 1.0)
    }
}

// MARK: - Data Models

struct UrgentNudge: Identifiable {
    let id = UUID()
    let type: NudgeType
    let title: String
    let action: NudgeAction
    let priority: Priority
    
    enum NudgeType {
        case followUp
        case nextAction
        case opportunity
    }
    
    enum NudgeAction {
        case viewFollowUp(id: UUID)
        case viewOpportunity(id: UUID?)
        case viewCampaign(id: UUID)
    }
    
    enum Priority: Int {
        case low = 0
        case medium = 1
        case high = 2
        case urgent = 3
    }
}

struct MorningBriefing {
    let newCampaignResponses: Int
    let followUpsDueToday: Int
    let strongestLead: Opportunity?
    let activeOpportunities: [Opportunity]
    let campaignHighlights: [String]
    
    var hasContent: Bool {
        newCampaignResponses > 0 || followUpsDueToday > 0 || strongestLead != nil
    }
    
    /// Generates a natural, varied summary without explaining the mechanics
    func generateSummary(greeting: String?) -> String {
        var parts: [String] = []
        
        // Opening - sometimes with greeting, sometimes direct
        if let greeting = greeting, Bool.random() {
            parts.append(greeting)
        }
        
        // Campaign responses
        if newCampaignResponses > 0 {
            if campaignHighlights.count == 1 {
                parts.append("Your '\(campaignHighlights[0])' campaign had \(newCampaignResponses) new \(newCampaignResponses == 1 ? "response" : "responses") overnight.")
            } else {
                parts.append("You have \(newCampaignResponses) new campaign \(newCampaignResponses == 1 ? "response" : "responses") to review.")
            }
        }
        
        // Follow-ups due
        if followUpsDueToday > 0 {
            parts.append("You have \(followUpsDueToday) \(followUpsDueToday == 1 ? "follow-up" : "follow-ups") due today.")
        }
        
        // Strongest lead suggestion
        if let lead = strongestLead, Bool.random() {
            parts.append("Your strongest lead is still the \(lead.companyName) opportunity — want to start there?")
        }
        
        return parts.joined(separator: " ")
    }
}

struct ReengagementBriefing {
    let daysAway: Int
    let opportunitiesAtRisk: Int
    let staleOpportunities: Int
    let hotOpportunities: [Opportunity]
    let goalProgress: GoalProgress
    let newResponses: Int
    let requiresAttention: Bool
    
    /// Generates a natural re-engagement message
    func generateSummary() -> String {
        var parts: [String] = []
        
        // Acknowledge the gap - but briefly and naturally
        if daysAway >= 3 {
            parts.append("Welcome back — it's been \(daysAway) days.")
        } else {
            parts.append("Welcome back.")
        }
        
        // What's changed
        var changes: [String] = []
        if newResponses > 0 {
            changes.append("\(newResponses) new \(newResponses == 1 ? "response" : "responses")")
        }
        if opportunitiesAtRisk > 0 {
            changes.append("\(opportunitiesAtRisk) \(opportunitiesAtRisk == 1 ? "opportunity" : "opportunities") that need attention before they go cold")
        }
        
        if !changes.isEmpty {
            parts.append("Here's what's changed: \(changes.joined(separator: " and ")).")
        }
        
        // Goal progress
        if goalProgress.consultingGoal > 0 {
            let percentage = Int(goalProgress.consultingGoal * 100)
            parts.append("Your consulting goal is \(percentage)% toward target.")
        }
        
        // Decision prompt
        if requiresAttention {
            parts.append("Want a full briefing or should we jump to the most urgent item?")
        } else {
            parts.append("Everything's on track. What would you like to focus on?")
        }
        
        return parts.joined(separator: " ")
    }
    
    var recommendedAction: BriefingAction {
        if opportunitiesAtRisk > 0 {
            return .viewAtRiskOpportunities
        } else if !hotOpportunities.isEmpty {
            return .viewHotOpportunity(id: hotOpportunities[0].id)
        } else if newResponses > 0 {
            return .reviewCampaignResponses
        } else {
            return .generalBriefing
        }
    }
}

struct GoalProgress {
    let consultingGoal: Double
    let recruiterGoal: Double
}

enum BriefingAction {
    case viewAtRiskOpportunities
    case viewHotOpportunity(id: UUID)
    case reviewCampaignResponses
    case generalBriefing
}
