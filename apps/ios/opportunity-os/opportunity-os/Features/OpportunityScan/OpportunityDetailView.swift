import SwiftUI

struct OpportunityDetailView: View {
    @StateObject var viewModel: OpportunityDetailViewModel
    let onDraftMessage: (Opportunity) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(viewModel.opportunity.title)
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(AppTheme.primaryText)
                Text(viewModel.opportunity.companyName)
                    .foregroundStyle(AppTheme.mutedText)
                Text(viewModel.opportunity.summary)
                    .foregroundStyle(AppTheme.primaryText)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Recommended Recipients")
                        .font(.headline)
                        .foregroundStyle(AppTheme.primaryText)
                    ForEach(viewModel.opportunity.recipients) { recipient in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(recipient.name)
                                .foregroundStyle(AppTheme.primaryText)
                            Text("\(recipient.role) • \(recipient.organization)")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppTheme.border))
                    }
                }

                Button("Draft Outreach") {
                    onDraftMessage(viewModel.opportunity)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .accessibilityIdentifier("opportunity.draftOutreach")
            }
            .padding()
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .accessibilityIdentifier("screen.opportunityDetail")
    }
}
