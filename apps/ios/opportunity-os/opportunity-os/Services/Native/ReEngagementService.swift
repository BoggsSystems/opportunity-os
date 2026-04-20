import Foundation

/// Tracks user absence and determines the appropriate re-engagement tier
@MainActor
final class ReEngagementService: ObservableObject {
    private enum StorageKeys {
        static let lastActiveTimestamp = "opportunity_os.last_active_timestamp"
        static let lastBriefingShownAt = "opportunity_os.last_briefing_shown_at"
        static let firstLaunchCompleted = "opportunity_os.first_launch_completed"
        static let userTimezone = "opportunity_os.user_timezone"
    }
    
    private let defaults: UserDefaults
    
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }
    
    // MARK: - State Tracking
    
    func markActive() {
        defaults.set(Date().timeIntervalSince1970, forKey: StorageKeys.lastActiveTimestamp)
    }
    
    func markBriefingShown() {
        defaults.set(Date().timeIntervalSince1970, forKey: StorageKeys.lastBriefingShownAt)
    }
    
    func markFirstLaunchCompleted() {
        defaults.set(true, forKey: StorageKeys.firstLaunchCompleted)
    }
    
    var isFirstLaunch: Bool {
        !defaults.bool(forKey: StorageKeys.firstLaunchCompleted)
    }
    
    var lastActiveTimestamp: Date? {
        let timestamp = defaults.double(forKey: StorageKeys.lastActiveTimestamp)
        return timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }
    
    var lastBriefingShownAt: Date? {
        let timestamp = defaults.double(forKey: StorageKeys.lastBriefingShownAt)
        return timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }
    
    // MARK: - Tier Determination
    
    /// Determines the appropriate re-engagement tier based on time away
    /// Returns nil if no re-engagement should be shown
    func determineTier() -> ReEngagementTier? {
        guard !isFirstLaunch else {
            return nil // First launch handled separately via onboarding
        }
        
        guard let lastActive = lastActiveTimestamp else {
            // No previous session - treat as extended absence but don't show briefing
            return nil
        }
        
        let timeAway = Date().timeIntervalSince(lastActive)
        
        // Tier 0: Instant return (< 2 minutes) - do nothing
        if timeAway < 120 {
            return nil
        }
        
        // Tier 1: Short break (2-30 minutes) - silent refresh, no briefing
        if timeAway < 30 * 60 {
            return .silentRefresh
        }
        
        // Tier 2: Session break (30 min - 4 hours) - urgent nudge only if not shown recently
        if timeAway < 4 * 60 * 60 {
            if shouldShowBriefing(forTier: .sessionBreak) {
                return .sessionBreak(timeAway: timeAway)
            }
            return .silentRefresh
        }
        
        // Tier 3: Day break (4-24 hours) - morning briefing
        if timeAway < 24 * 60 * 60 {
            if shouldShowBriefing(forTier: .dayBreak) {
                return .dayBreak(timeAway: timeAway)
            }
            return .silentRefresh
        }
        
        // Tier 4: Extended absence (> 24 hours) - re-engagement briefing
        if shouldShowBriefing(forTier: .extendedAbsence) {
            return .extendedAbsence(timeAway: timeAway)
        }
        return .silentRefresh
    }
    
    private func shouldShowBriefing(forTier tierType: ReEngagementTierType) -> Bool {
        guard let lastBriefing = lastBriefingShownAt else {
            return true
        }
        
        let timeSinceLastBriefing = Date().timeIntervalSince(lastBriefing)
        
        // Don't show the same tier more than once per hour
        return timeSinceLastBriefing > 60 * 60
    }
    
    // MARK: - Timezone Handling
    
    func updateTimezone(_ timezone: TimeZone) {
        defaults.set(timezone.identifier, forKey: StorageKeys.userTimezone)
    }
    
    var userTimezone: TimeZone {
        if let identifier = defaults.string(forKey: StorageKeys.userTimezone),
           let timezone = TimeZone(identifier: identifier) {
            return timezone
        }
        return TimeZone.current
    }
    
    var isNightTime: Bool {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour < 6 || hour > 22
    }
    
    /// Returns appropriate greeting based on time of day
    func timeAppropriateGreeting() -> String? {
        let hour = Calendar.current.component(.hour, from: Date())
        
        switch hour {
        case 5..<12:
            return "Good morning"
        case 12..<17:
            return nil // Afternoon - skip greeting for spontaneity
        case 17..<22:
            return nil // Evening - skip greeting
        default:
            return nil // Night - no greeting
        }
    }
}

/// Represents the tier type without associated values (for comparisons)
enum ReEngagementTierType: Equatable {
    case silentRefresh
    case sessionBreak
    case dayBreak
    case extendedAbsence
}

/// Represents the different re-engagement tiers
enum ReEngagementTier: Equatable {
    /// Tier 1: Silent data refresh, no UI (2-30 min away)
    case silentRefresh
    
    /// Tier 2: One-line urgent nudge (30 min - 4 hours)
    case sessionBreak(timeAway: TimeInterval)
    
    /// Tier 3: Morning briefing with goal/campaign summary (4-24 hours)
    case dayBreak(timeAway: TimeInterval)
    
    /// Tier 4: Full re-engagement with what's changed (> 24 hours)
    case extendedAbsence(timeAway: TimeInterval)
    
    /// Returns the tier type without associated values
    var type: ReEngagementTierType {
        switch self {
        case .silentRefresh:
            return .silentRefresh
        case .sessionBreak:
            return .sessionBreak
        case .dayBreak:
            return .dayBreak
        case .extendedAbsence:
            return .extendedAbsence
        }
    }
    
    var description: String {
        switch self {
        case .silentRefresh:
            return "Silent Refresh"
        case .sessionBreak:
            return "Session Break"
        case .dayBreak:
            return "Day Break"
        case .extendedAbsence:
            return "Extended Absence"
        }
    }
}
