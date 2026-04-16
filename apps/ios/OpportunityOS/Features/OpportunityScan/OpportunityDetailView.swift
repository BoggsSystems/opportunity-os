import SwiftUI

struct OpportunityDetailView: View {
    @StateObject var viewModel: OpportunityDetailViewModel
    let onDraftMessage: (Opportunity) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(viewModel.opportunity.title)
                    .font(.largeTitle.weight(.bold))
                Text(viewModel.opportunity.companyName)
                    .foregroundStyle(AppTheme.mutedText)
                Text(viewModel.opportunity.summary)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Recommended Recipients")
                        .font(.headline)
                    ForEach(viewModel.opportunity.recipients) { recipient in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(recipient.name)
                            Text("\(recipient.role) • \(recipient.organization)")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 16))
                    }
                }

                Button("Draft Outreach") {
                    onDraftMessage(viewModel.opportunity)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
            }
            .padding()
        }
        .background(AppTheme.background.ignoresSafeArea())
        .foregroundStyle(Color.white)
    }
}
