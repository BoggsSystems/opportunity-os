import SwiftUI

struct StrategicProposalModal: View {
    let plan: StrategicPlan
    var titleOverride: String? = nil
    var confirmButtonLabel: String? = nil
    let onConfirm: () async -> Void
    let onDismiss: () -> Void
    let onNavigateToDashboard: () -> Void

    @State private var isConfirming = false
    @State private var showSuccess = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(titleOverride ?? "🎯 New Goal Formed")
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(AppTheme.mutedText)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 16)

            Divider()
                .background(AppTheme.border)

            // Content
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("The Goal")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                        .textCase(.uppercase)
                    
                    Text(plan.firstCycleTitle)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(AppTheme.primaryText)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("What I'm Hearing")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                        .textCase(.uppercase)
                    
                    Text(plan.confirmationMessage)
                        .font(.body)
                        .foregroundStyle(AppTheme.primaryText)
                        .lineLimit(4)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Strategic Steps")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.accent)
                        .textCase(.uppercase)
                    
                    ForEach(plan.firstCycleSteps, id: \.self) { step in
                        HStack(spacing: 12) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(AppTheme.accent)
                            Text(step)
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.primaryText)
                        }
                    }
                }
                .padding()
                .background(AppTheme.accentSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(24)

            Divider()
                .background(AppTheme.border)

            // Footer / Actions
            VStack(spacing: 16) {
                Button(action: handleConfirm) {
                    HStack {
                        if showSuccess {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3.weight(.bold))
                                .transition(.scale.combined(with: .opacity))
                        } else if isConfirming {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.8)
                        } else {
                            Text(confirmButtonLabel ?? "Confirm & Continue")
                                .font(.headline)
                                .transition(.opacity)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(showSuccess ? Color.green : AppTheme.accent, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.white)
                }
                .disabled(isConfirming || showSuccess)
                
                if !showSuccess {
                    Button(action: onNavigateToDashboard) {
                        HStack {
                            Text("View in your Dashboard")
                            Image(systemName: "arrow.right")
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.accent)
                    }
                    .padding(.bottom, 8)
                }
            }
            .padding(24)
        }
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.2), radius: 40, y: 20)
        .padding(20)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: showSuccess)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isConfirming)
    }

    private func handleConfirm() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        
        isConfirming = true
        
        Task {
            // Actually wait for the backend to finish
            await onConfirm()
            
            await MainActor.run {
                generator.notificationOccurred(.success)
                withAnimation {
                    showSuccess = true
                    isConfirming = false
                }
            }
            
            // Brief pause to let them see the green check before VM closes it
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }
}

#Preview {
    ZStack {
        Color.gray.opacity(0.3).ignoresSafeArea()
        
        StrategicProposalModal(
            plan: StrategicPlan(
                focusArea: "General",
                opportunityType: "outreach",
                targetAudience: "Trading Recruiters",
                firstCycleTitle: "Greenfield Trading Systems Outreach",
                assistantSummary: "Finding new infrastructure builds.",
                confirmationMessage: "We're going to identify and reach out to 50+ financial recruiters specializing in trading systems to secure a Greenfield role.",
                firstCycleSteps: ["Qualify recruiter list", "Draft specialized angle", "Send initial messages"],
                firstDraftPrompt: "Draft an email for trading recruiters."
            ),
            onConfirm: {},
            onDismiss: {},
            onNavigateToDashboard: {}
        )
    }
}
