import SwiftUI

struct HomeView: View {
    @StateObject var viewModel: HomeViewModel
    let onOpenOpportunities: () -> Void
    let onOpenContent: () -> Void
    let onContinueCycle: (Opportunity) -> Void
    let onOpenSettings: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Cycle Dashboard")
                            .font(.largeTitle.weight(.bold))
                        Text("Stay in motion. One meaningful action at a time.")
                            .foregroundStyle(AppTheme.mutedText)
                    }
                    Spacer()
                    Button(action: onOpenSettings) {
                        Image(systemName: "slider.horizontal.3")
                    }
                    .buttonStyle(.bordered)
                }

                VStack(spacing: 18) {
                    VoiceOrbView(isListening: viewModel.isSpeaking)
                    Text(viewModel.headlinePrompt)
                        .font(.title3)
                        .multilineTextAlignment(.center)
                    Button("Speak Prompt") {
                        viewModel.speakPrompt()
                    }
                    .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)

                CycleIndicatorView(cycle: viewModel.cycle)

                if let opportunity = viewModel.opportunities.first {
                    ActionPromptCard(
                        title: "Next Recommended Action",
                        subtitle: opportunity.summary,
                        buttonTitle: "Draft Outreach"
                    ) {
                        onContinueCycle(opportunity)
                    }
                }

                HStack(spacing: 12) {
                    Button("Opportunity Scan", action: onOpenOpportunities)
                        .buttonStyle(.borderedProminent)
                    Button("Content Discovery", action: onOpenContent)
                        .buttonStyle(.bordered)
                }

                if let content = viewModel.contentItems.first {
                    ActionPromptCard(
                        title: content.title,
                        subtitle: content.campaignPotential,
                        buttonTitle: "Review Content"
                    ) {
                        onOpenContent()
                    }
                }
            }
            .padding(20)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .foregroundStyle(Color.white)
        .task {
            await viewModel.load()
        }
    }
}
