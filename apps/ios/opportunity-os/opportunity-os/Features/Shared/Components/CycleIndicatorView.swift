import SwiftUI

struct CycleIndicatorView: View {
    let cycle: Cycle

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(cycle.title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
                Spacer()
                Text("\(Int(cycle.progress * 100))%")
                    .foregroundStyle(AppTheme.mutedText)
            }

            ProgressView(value: cycle.progress)
                .tint(AppTheme.accent)

            Text("Current step: \(cycle.currentStep.rawValue.capitalized)")
                .font(.subheadline)
                .foregroundStyle(AppTheme.mutedText)
        }
        .padding()
        .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(AppTheme.border))
        .shadow(color: AppTheme.shadow, radius: 18, y: 8)
    }
}
