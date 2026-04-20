import Foundation

// MARK: - FollowUpItem Extensions

extension FollowUpItem {
    /// Whether this follow-up is due within the next 4 hours
    var isDueSoon: Bool {
        let hoursUntilDue = dueDate.timeIntervalSinceNow / 3600
        return hoursUntilDue > 0 && hoursUntilDue <= 4
    }
    
    /// Whether this follow-up is due today
    var isDueToday: Bool {
        Calendar.current.isDateInToday(dueDate)
    }
    
    /// Whether this follow-up is overdue and at risk of going cold
    var isAtRisk: Bool {
        let hoursOverdue = -dueDate.timeIntervalSinceNow / 3600
        return hoursOverdue > 24 // Overdue by more than a day
    }
    
    /// Time until due formatted for display
    var timeUntilDueFormatted: String {
        let hours = Int(dueDate.timeIntervalSinceNow / 3600)
        if hours < 1 {
            let minutes = Int(dueDate.timeIntervalSinceNow / 60)
            return "\(minutes) minutes"
        } else if hours == 1 {
            return "1 hour"
        } else {
            return "\(hours) hours"
        }
    }
    
    /// The name of the recipient for this follow-up
    var recipientName: String {
        recipient.name
    }
    
    /// Priority level based on urgency
    var priority: UrgentNudge.Priority {
        if isAtRisk {
            return .urgent
        } else if isDueSoon {
            return .high
        } else if isDueToday {
            return .medium
        } else {
            return .low
        }
    }
}

// MARK: - Opportunity Extensions

extension Opportunity {
    /// Whether this opportunity has had activity in the last 24 hours
    var hasRecentActivity: Bool {
        // This would typically check an `updatedAt` or `lastActivityAt` field
        // For now, using momentum score as a proxy
        return momentumScore > 60
    }
    
    /// Days since last activity (mock implementation)
    var daysSinceLastActivity: Int {
        // This would typically calculate from `lastActivityAt`
        // Lower momentum = longer since activity
        return max(0, (100 - momentumScore) / 10)
    }
}

// MARK: - StrategicCampaign Extensions

extension StrategicCampaign {
    /// Number of new responses since last check (mock implementation)
    var newResponseCount: Int {
        // This would typically be calculated from campaign analytics
        // For now, return a value based on status
        switch status {
        case .active:
            return Int.random(in: 0...2) // Simulated: 0-2 new responses
        case .planning, .paused, .completed:
            return 0
        }
    }
    
    /// Total contacts in the campaign (mock implementation)
    var totalContacts: Int {
        // This would come from campaign data
        return Int.random(in: 5...50)
    }
}

// MARK: - CampaignStatus Extensions

extension CampaignStatus {
    var displayName: String {
        switch self {
        case .planning: return "Planning"
        case .active: return "Active"
        case .paused: return "Paused"
        case .completed: return "Completed"
        }
    }
}
