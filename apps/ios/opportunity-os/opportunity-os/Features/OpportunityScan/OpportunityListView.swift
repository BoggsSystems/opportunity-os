import SwiftUI

struct OpportunityListView: View {
    @StateObject var viewModel: OpportunityListViewModel
    let onSelect: (Opportunity) -> Void

    var body: some View {
        Group {
            if viewModel.opportunities.isEmpty {
                ContentUnavailableView(
                    "No Opportunities Yet",
                    systemImage: "sparkles.rectangle.stack",
                    description: Text("Create an opportunity in the backend and it will appear here.")
                )
                .foregroundStyle(AppTheme.primaryText, AppTheme.mutedText)
            } else {
                List(viewModel.opportunities) { opportunity in
                    Button {
                        onSelect(opportunity)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(opportunity.title)
                                .foregroundStyle(AppTheme.primaryText)
                            Text(opportunity.companyName)
                                .foregroundStyle(AppTheme.mutedText)
                            Text(opportunity.summary)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(AppTheme.surface)
                    .accessibilityIdentifier("opportunity.row.\(opportunity.id.uuidString)")
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(AppTheme.pageBackground)
        .navigationTitle("Opportunities")
        .accessibilityIdentifier("screen.opportunityList")
        .task {
            await viewModel.load()
        }
    }
}
