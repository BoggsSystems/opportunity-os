import SwiftUI

/// Main container view for re-engagement content
struct ReEngagementView: View {
    @ObservedObject var viewModel: ReEngagementViewModel
    let onAction: (ReEngagementAction) -> Void
    
    var body: some View {
        Group {
            switch viewModel.currentTier {
            case .idle, .silentRefresh:
                EmptyView()
                
            case .showingNudge(let nudge):
                UrgentNudgeView(
                    nudge: nudge,
                    onDismiss: { viewModel.dismissCurrentBriefing() },
                    onAction: { onAction(.nudge($0)) }
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                
            case .showingMorningBriefing(let briefing, let greeting):
                MorningBriefingView(
                    briefing: briefing,
                    greeting: greeting,
                    onDismiss: { viewModel.dismissCurrentBriefing() },
                    onAction: { onAction(.briefing($0)) }
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                
            case .showingReengagementBriefing(let briefing):
                ReengagementBriefingView(
                    briefing: briefing,
                    onDismiss: { viewModel.dismissCurrentBriefing() },
                    onFullBriefing: { viewModel.requestFullBriefing() },
                    onJumpToUrgent: { viewModel.jumpToMostUrgent() }
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: viewModel.currentTier)
    }
}

enum ReEngagementAction {
    case nudge(UrgentNudge.NudgeAction)
    case briefing(BriefingAction)
}

// MARK: - Tier 2: Urgent Nudge View

struct UrgentNudgeView: View {
    let nudge: UrgentNudge
    let onDismiss: () -> Void
    let onAction: (UrgentNudge.NudgeAction) -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                // Priority indicator
                Circle()
                    .fill(priorityColor)
                    .frame(width: 8, height: 8)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(nudge.title)
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.primaryText)
                        .lineLimit(2)
                }
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            
            // Action button - subtle, not demanding
            Button {
                onAction(nudge.action)
            } label: {
                HStack {
                    Text(actionButtonText)
                        .font(.caption.weight(.medium))
                    Image(systemName: "arrow.right")
                        .font(.caption)
                }
                .foregroundStyle(AppTheme.accent)
            }
        }
        .padding(16)
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : -20)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(0.3)) {
                isVisible = true
            }
        }
    }
    
    private var priorityColor: Color {
        switch nudge.priority {
        case .urgent:
            return .red
        case .high:
            return .orange
        case .medium:
            return .yellow
        case .low:
            return .green
        }
    }
    
    private var actionButtonText: String {
        switch nudge.action {
        case .viewFollowUp:
            return "View follow-up"
        case .viewOpportunity:
            return "View opportunity"
        case .viewCampaign:
            return "View campaign"
        }
    }
}

// MARK: - Tier 3: Morning Briefing View

struct MorningBriefingView: View {
    let briefing: MorningBriefing
    let greeting: String?
    let onDismiss: () -> Void
    let onAction: (BriefingAction) -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header with dismiss
            HStack {
                if let greeting = greeting {
                    Text(greeting)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(AppTheme.primaryText)
                }
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            
            // Natural summary text
            Text(briefing.generateSummary(greeting: nil))
                .font(.body)
                .foregroundStyle(AppTheme.primaryText)
                .lineSpacing(4)
            
            // Quick actions - only if there are actionable items
            if briefing.followUpsDueToday > 0 || briefing.newCampaignResponses > 0 {
                HStack(spacing: 12) {
                    if briefing.followUpsDueToday > 0 {
                        QuickActionButton(
                            title: "View \(briefing.followUpsDueToday) follow-ups",
                            icon: "checkmark.circle.fill",
                            action: { onAction(.viewAtRiskOpportunities) }
                        )
                    }
                    
                    if let strongestLead = briefing.strongestLead {
                        QuickActionButton(
                            title: "Go to strongest lead",
                            icon: "arrow.up.right.circle.fill",
                            action: { onAction(.viewHotOpportunity(id: strongestLead.id)) }
                        )
                    }
                }
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [AppTheme.surface, AppTheme.surface.opacity(0.95)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.1), radius: 20, x: 0, y: 8)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : -30)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.2)) {
                isVisible = true
            }
        }
    }
}

// MARK: - Tier 4: Re-engagement Briefing View

struct ReengagementBriefingView: View {
    let briefing: ReengagementBriefing
    let onDismiss: () -> Void
    let onFullBriefing: () -> Void
    let onJumpToUrgent: () -> Void
    
    @State private var isVisible = false
    @State private var showDetailed = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Welcome back")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(AppTheme.primaryText)
                    
                    if briefing.daysAway >= 3 {
                        Text("It's been \(briefing.daysAway) days")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                }
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            
            // Summary text
            Text(briefing.generateSummary())
                .font(.body)
                .foregroundStyle(AppTheme.primaryText)
                .lineSpacing(4)
            
            // Status indicators
            HStack(spacing: 16) {
                if briefing.newResponses > 0 {
                    StatusPill(
                        icon: "envelope.fill",
                        text: "\(briefing.newResponses) new",
                        color: .blue
                    )
                }
                
                if briefing.opportunitiesAtRisk > 0 {
                    StatusPill(
                        icon: "exclamationmark.triangle.fill",
                        text: "\(briefing.opportunitiesAtRisk) at risk",
                        color: .orange
                    )
                }
                
                if briefing.goalProgress.consultingGoal > 0 {
                    StatusPill(
                        icon: "target",
                        text: "\(Int(briefing.goalProgress.consultingGoal * 100))% to goal",
                        color: .green
                    )
                }
            }
            
            // Action buttons
            HStack(spacing: 12) {
                if briefing.requiresAttention {
                    Button(action: onJumpToUrgent) {
                        HStack {
                            Image(systemName: "flame.fill")
                            Text("Most urgent")
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(AppTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                
                Button(action: onFullBriefing) {
                    HStack {
                        Image(systemName: "list.bullet.rectangle")
                        Text("Full briefing")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(AppTheme.accent.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                
                Spacer()
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [AppTheme.surface, AppTheme.surface.opacity(0.95)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.12), radius: 24, x: 0, y: 8)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : -40)
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.7).delay(0.15)) {
                isVisible = true
            }
        }
    }
}

// MARK: - Supporting Views

struct QuickActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(AppTheme.accent)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(AppTheme.accent.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct StatusPill: View {
    let icon: String
    let text: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
                .font(.caption.weight(.medium))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.12))
        .clipShape(Capsule())
    }
}
