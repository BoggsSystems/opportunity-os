import SwiftUI

struct OpportunityListView: View {
    @StateObject var viewModel: OpportunityListViewModel
    let onSelect: (Opportunity) -> Void

    var body: some View {
        List(viewModel.opportunities) { opportunity in
            Button {
                onSelect(opportunity)
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    Text(opportunity.title)
                    Text(opportunity.companyName)
                        .foregroundStyle(AppTheme.mutedText)
                    Text(opportunity.summary)
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            .buttonStyle(.plain)
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.background)
        .navigationTitle("Opportunities")
        .task {
            await viewModel.load()
        }
    }
}
