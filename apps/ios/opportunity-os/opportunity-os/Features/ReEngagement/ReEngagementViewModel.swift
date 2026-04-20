import SwiftUI

/// ViewModel for managing re-engagement UI state
@MainActor
final class ReEngagementViewModel: ObservableObject {
    private let reEngagementService: ReEngagementService
    private let briefingService: ReEngagementBriefingService
    private let speechSynthesisService: SpeechSynthesisServiceProtocol?
    private let sessionManager: SessionManager?
    
    var onBriefingGenerated: ((String) -> Void)?
    
    @Published var currentTier: ReEngagementTierState = .idle
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Tier-specific data
    @Published var urgentNudge: UrgentNudge?
    @Published var morningBriefing: MorningBriefing?
    @Published var reengagementBriefing: ReengagementBriefing?
    
    init(
        reEngagementService: ReEngagementService? = nil,
        briefingService: ReEngagementBriefingService,
        speechSynthesisService: SpeechSynthesisServiceProtocol? = nil,
        sessionManager: SessionManager? = nil
    ) {
        self.reEngagementService = reEngagementService ?? ReEngagementService()
        self.briefingService = briefingService
        self.speechSynthesisService = speechSynthesisService
        self.sessionManager = sessionManager
    }
    
    // MARK: - Scene Phase Handling
    
    /// Call this when the app becomes active
    func handleAppBecameActive() async {
        defer { reEngagementService.markActive() }
        
        guard let tier = reEngagementService.determineTier() else {
            currentTier = .idle
            return
        }
        
        isLoading = true
        defer { isLoading = false }
        
        switch tier {
        case .silentRefresh:
            currentTier = .silentRefresh
            // Trigger silent data refresh in background
            await performSilentRefresh()
            
        case .sessionBreak(let timeAway):
            await handleSessionBreak(timeAway: timeAway)
            
        case .dayBreak(let timeAway):
            await handleDayBreak(timeAway: timeAway)
            
        case .extendedAbsence(let timeAway):
            await handleExtendedAbsence(timeAway: timeAway)
        }
    }
    
    /// Call this when the app goes inactive/background
    func handleAppBecameInactive() {
        reEngagementService.markActive()
    }
    
    // MARK: - Tier Handlers
    
    private func handleSessionBreak(timeAway: TimeInterval) async {
        let nudge = await briefingService.fetchUrgentNudge()
        
        if let nudge = nudge {
            self.urgentNudge = nudge
            self.currentTier = .showingNudge(nudge)
            reEngagementService.markBriefingShown()
            
            let summary = nudge.title
            onBriefingGenerated?(summary)
            if let speech = speechSynthesisService, let manager = sessionManager {
                await speech.speak(summary, preference: manager.voicePreference)
            }
        } else {
            // No urgent items - stay silent
            self.currentTier = .idle
        }
    }
    
    private func handleDayBreak(timeAway: TimeInterval) async {
        let greeting = reEngagementService.timeAppropriateGreeting()
        let briefing = await briefingService.fetchMorningBriefing()
        
        if let briefing = briefing, briefing.hasContent {
            self.morningBriefing = briefing
            self.currentTier = .showingMorningBriefing(briefing, greeting: greeting)
            reEngagementService.markBriefingShown()
            
            let summary = briefing.generateSummary(greeting: greeting)
            onBriefingGenerated?(summary)
            if let speech = speechSynthesisService, let manager = sessionManager {
                await speech.speak(summary, preference: manager.voicePreference)
            }
        } else {
            // Nothing notable to report
            self.currentTier = .idle
        }
    }
    
    private func handleExtendedAbsence(timeAway: TimeInterval) async {
        let daysAway = Int(timeAway / (24 * 60 * 60))
        let briefing = await briefingService.fetchReengagementBriefing(daysAway: daysAway)
        
        if let briefing = briefing {
            self.reengagementBriefing = briefing
            self.currentTier = .showingReengagementBriefing(briefing)
            reEngagementService.markBriefingShown()
            
            let summary = briefing.generateSummary()
            onBriefingGenerated?(summary)
            if let speech = speechSynthesisService, let manager = sessionManager {
                await speech.speak(summary, preference: manager.voicePreference)
            }
        } else {
            self.currentTier = .idle
        }
    }
    
    private func performSilentRefresh() async {
        // Trigger background refresh of key data
        // This happens silently without UI updates
        _ = await briefingService.fetchUrgentNudge()
    }
    
    // MARK: - User Actions
    
    func dismissCurrentBriefing() {
        currentTier = .idle
        reEngagementService.markBriefingShown()
    }
    
    func acceptNudgeAction(_ action: UrgentNudge.NudgeAction) {
        dismissCurrentBriefing()
        // Navigation would be handled by coordinator
    }
    
    func acceptBriefingAction(_ action: BriefingAction) {
        dismissCurrentBriefing()
        // Navigation would be handled by coordinator
    }
    
    func requestFullBriefing() {
        // User wants the detailed version - could expand the current briefing
        // or navigate to a dedicated briefing screen
    }
    
    func jumpToMostUrgent() {
        if let briefing = reengagementBriefing {
            acceptBriefingAction(briefing.recommendedAction)
        }
    }
}

/// Represents the current state of re-engagement UI
enum ReEngagementTierState: Equatable {
    case idle
    case silentRefresh
    case showingNudge(UrgentNudge)
    case showingMorningBriefing(MorningBriefing, greeting: String?)
    case showingReengagementBriefing(ReengagementBriefing)
    
    static func == (lhs: ReEngagementTierState, rhs: ReEngagementTierState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.silentRefresh, .silentRefresh):
            return true
        case (.showingNudge(let l), .showingNudge(let r)):
            return l.id == r.id
        case (.showingMorningBriefing(let lb, let lg), .showingMorningBriefing(let rb, let rg)):
            return lb.newCampaignResponses == rb.newCampaignResponses &&
                   lb.followUpsDueToday == rb.followUpsDueToday &&
                   lg == rg
        case (.showingReengagementBriefing(let l), .showingReengagementBriefing(let r)):
            return l.daysAway == r.daysAway && l.requiresAttention == r.requiresAttention
        default:
            return false
        }
    }
    
    var isShowingBriefing: Bool {
        switch self {
        case .showingNudge, .showingMorningBriefing, .showingReengagementBriefing:
            return true
        default:
            return false
        }
    }
}
