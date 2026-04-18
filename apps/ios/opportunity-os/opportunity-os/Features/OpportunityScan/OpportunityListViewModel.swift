import Foundation

@MainActor
final class OpportunityListViewModel: ObservableObject {
    @Published var opportunities: [Opportunity] = []

    private let opportunityService: OpportunityServiceProtocol

    init(opportunityService: OpportunityServiceProtocol) {
        self.opportunityService = opportunityService
    }

    func load() async {
        opportunities = await opportunityService.fetchRecommendedOpportunities()
    }
}
