import SwiftUI

@main
struct OpportunityOSApp: App {
    @StateObject private var rootCoordinator = RootCoordinator(container: AppContainer.preview)

    var body: some Scene {
        WindowGroup {
            ReEngagementContainer(
                briefingService: rootCoordinator.container.reEngagementBriefingService,
                speechSynthesisService: rootCoordinator.container.speechSynthesisService,
                sessionManager: rootCoordinator.container.sessionManager,
                onBriefingGenerated: { summary in
                    Task { @MainActor in
                        rootCoordinator.unifiedViewModel.messages.append(
                            SessionMessage(role: .assistant, text: summary)
                        )
                    }
                },
                onNavigate: { action in
                    handleReEngagementAction(action)
                }
            ) {
                AppRootView()
                    .environmentObject(rootCoordinator)
                    .environmentObject(rootCoordinator.container.sessionManager)
            }
        }
    }
    
    @MainActor
    private func handleReEngagementAction(_ action: ReEngagementAction) {
        // Route navigation actions from re-engagement to the coordinator
        switch action {
        case .nudge(let nudgeAction):
            switch nudgeAction {
            case .viewFollowUp(let id):
                // rootCoordinator.showFollowUp(id)
                break
            case .viewOpportunity(let id):
                if let id = id {
                    // rootCoordinator.showOpportunity(id)
                }
            case .viewCampaign(let id):
                // rootCoordinator.showCampaign(id)
                break
            }
        case .briefing(let briefingAction):
            switch briefingAction {
            case .viewAtRiskOpportunities:
                // rootCoordinator.showAtRiskOpportunities()
                break
            case .viewHotOpportunity(let id):
                // rootCoordinator.showOpportunity(id)
                break
            case .reviewCampaignResponses:
                // rootCoordinator.showCampaignResponses()
                break
            case .generalBriefing:
                // rootCoordinator.showFullBriefing()
                break
            }
        }
    }
}
