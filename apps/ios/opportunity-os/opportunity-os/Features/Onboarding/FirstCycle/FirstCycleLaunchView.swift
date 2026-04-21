import SwiftUI

struct FirstCycleLaunchView: View {
    let plan: StrategicPlan
    let onEnterApp: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your first cycle is ready")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(AppTheme.primaryText)
                    Text("You’re not landing in an empty dashboard. You’re arriving with a clear first motion.")
                        .font(.body)
                        .foregroundStyle(AppTheme.mutedText)
                }

                summaryCard
                stepsCard
                promptCard

                Button("Enter Opportunity OS") {
                    onEnterApp()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .controlSize(.large)
                .accessibilityIdentifier("onboarding.enterOpportunityOS")
            }
            .padding(24)
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationTitle("First Cycle")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen.firstCycleLaunch")
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(plan.firstCycleTitle)
                .font(.title2.weight(.bold))
                .foregroundStyle(AppTheme.primaryText)
            Text(plan.assistantSummary)
                .font(.body)
                .foregroundStyle(AppTheme.primaryText)
            Text("Targeting \(plan.targetAudience)")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
        }
        .padding(22)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("We’ll guide you through")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)

            ForEach(Array(plan.firstCycleSteps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                        .frame(width: 22, height: 22)
                        .background(AppTheme.accentSoft, in: Circle())
                    Text(step)
                        .font(.body)
                        .foregroundStyle(AppTheme.primaryText)
                }
            }
        }
        .padding(22)
        .background(AppTheme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 24, y: 12)
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("First prompt")
                .font(.headline)
                .foregroundStyle(AppTheme.primaryText)
            Text(plan.firstDraftPrompt)
                .font(.body)
                .foregroundStyle(AppTheme.primaryText)
        }
        .padding(22)
        .background(AppTheme.accentSoft, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(AppTheme.border))
    }
}
