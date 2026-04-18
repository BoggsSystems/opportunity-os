import Foundation

@MainActor
final class OpportunityDetailViewModel: ObservableObject {
    @Published var opportunity: Opportunity

    init(opportunity: Opportunity) {
        self.opportunity = opportunity
    }
}
