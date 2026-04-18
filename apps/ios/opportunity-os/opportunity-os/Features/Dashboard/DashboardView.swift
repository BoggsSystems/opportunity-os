import SwiftUI

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var opportunities: [Opportunity] = []
    @Published var contentItems: [ContentItem] = []
    @Published var followUps: [FollowUpItem] = []
    @Published var nextAction: NextAction?
    @Published var isLoading = false

    private let opportunityService: OpportunityServiceProtocol
    private let nextActionService: NextActionServiceProtocol
    private let followUpService: FollowUpServiceProtocol
    private let contentDiscoveryService: ContentDiscoveryServiceProtocol

    init(
        opportunityService: OpportunityServiceProtocol,
        nextActionService: NextActionServiceProtocol,
        followUpService: FollowUpServiceProtocol,
        contentDiscoveryService: ContentDiscoveryServiceProtocol
    ) {
        self.opportunityService = opportunityService
        self.nextActionService = nextActionService
        self.followUpService = followUpService
        self.contentDiscoveryService = contentDiscoveryService
    }

    func load() async {
        isLoading = true
        opportunities = await opportunityService.fetchRecommendedOpportunities()
        nextAction = await nextActionService.fetchTopNextAction()
        followUps = await followUpService.fetchFollowUps()
        contentItems = await contentDiscoveryService.fetchDiscoveredContent()
        isLoading = false
    }

    var averageMomentum: Int {
        guard !opportunities.isEmpty else { return 0 }
        let total = opportunities.reduce(0) { $0 + $1.momentumScore }
        return total / opportunities.count
    }
}

struct DashboardView: View {
    @StateObject var viewModel: DashboardViewModel
    let onOpenActions: () -> Void
    let onOpenOpportunities: () -> Void
    let onOpenContent: () -> Void
    let onSelectOpportunity: (Opportunity) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                metricsGrid
                recommendationCard
                opportunitiesSection
                discoverySection
                followUpsSection
            }
            .padding(20)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
        .accessibilityIdentifier("screen.dashboard")
        .task {
            await viewModel.load()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Dashboard")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)
            Text("A traditional view of your opportunities, discovery inventory, and current cycle health.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
        }
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
            metricCard(title: "Live Opportunities", value: "\(viewModel.opportunities.count)", detail: "Active records")
            metricCard(title: "Discovery Items", value: "\(viewModel.contentItems.count)", detail: "Ready content")
            metricCard(title: "Follow-Ups", value: "\(viewModel.followUps.count)", detail: "Queued tasks")
            metricCard(title: "Avg Momentum", value: "\(viewModel.averageMomentum)", detail: "Cycle health")
        }
    }

    private var recommendationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Current Recommendation")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            Text(viewModel.nextAction?.title ?? "No recommendation yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(AppTheme.primaryText)

            Text(viewModel.nextAction?.reason ?? "Once the assistant has enough context, the next best move will show here.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)

            Button("Open Actions", action: onOpenActions)
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 20, y: 10)
    }

    private var opportunitiesSection: some View {
        dashboardSection(
            title: "Opportunities",
            actionTitle: "Open List",
            action: onOpenOpportunities
        ) {
            if viewModel.opportunities.isEmpty {
                emptyState("No live opportunities yet.")
            } else {
                ForEach(viewModel.opportunities.prefix(3)) { opportunity in
                    Button {
                        onSelectOpportunity(opportunity)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(opportunity.title)
                                .font(.headline)
                                .foregroundStyle(AppTheme.primaryText)
                            Text(opportunity.companyName)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(AppTheme.accent)
                            Text(opportunity.summary)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                                .lineLimit(2)
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var discoverySection: some View {
        dashboardSection(
            title: "Content Discovery",
            actionTitle: "Open Discovery",
            action: onOpenContent
        ) {
            if viewModel.contentItems.isEmpty {
                emptyState("No discovery content is queued right now.")
            } else {
                ForEach(viewModel.contentItems.prefix(3)) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(.headline)
                            .foregroundStyle(AppTheme.primaryText)
                        Text(item.source)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(AppTheme.accent)
                        Text(item.campaignPotential)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                            .lineLimit(2)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }
        }
    }

    private var followUpsSection: some View {
        dashboardSection(title: "Follow-Ups") {
            if viewModel.followUps.isEmpty {
                emptyState("No follow-ups are scheduled yet.")
            } else {
                ForEach(viewModel.followUps.prefix(3)) { followUp in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(followUp.title)
                            .font(.headline)
                            .foregroundStyle(AppTheme.primaryText)
                        Text(followUp.reason)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                        Text(followUp.recipient.name)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.accent)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }
        }
    }

    private func metricCard(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(AppTheme.mutedText)
            Text(value)
                .font(.title.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)
            Text(detail)
                .font(.caption)
                .foregroundStyle(AppTheme.mutedText)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(AppTheme.border))
    }

    private func dashboardSection<Content: View>(
        title: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
                Spacer()
                if let actionTitle, let action {
                    Button(actionTitle, action: action)
                        .buttonStyle(.bordered)
                        .tint(AppTheme.accent)
                }
            }

            content()
        }
    }

    private func emptyState(_ message: String) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(AppTheme.mutedText)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(AppTheme.border))
    }
}
