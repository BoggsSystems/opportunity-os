import SwiftUI

struct ContentDiscoveryView: View {
    @StateObject var viewModel: ContentDiscoveryViewModel

    var body: some View {
        List {
            Section("Discovered Content") {
                ForEach(viewModel.contentItems) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                        Text(item.source)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                        Text(item.campaignPotential)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                }
            }

            Section("Campaigns") {
                ForEach(viewModel.campaigns) { campaign in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(campaign.title)
                        Text(campaign.theme)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.mutedText)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.background)
        .navigationTitle("Content Discovery")
        .task {
            await viewModel.load()
        }
    }
}
