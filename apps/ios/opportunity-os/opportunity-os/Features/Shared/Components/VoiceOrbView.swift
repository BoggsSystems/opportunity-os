import SwiftUI

struct VoiceOrbView: View {
    var isListening: Bool
    var pulse: Bool = true

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [AppTheme.orbSecondary.opacity(0.96), AppTheme.orbPrimary.opacity(0.72)],
                        center: .center,
                        startRadius: 8,
                        endRadius: 130
                    )
                )
                .frame(width: 170, height: 170)
                .overlay(Circle().stroke(AppTheme.accent.opacity(0.15), lineWidth: 1))
                .shadow(color: AppTheme.orbPrimary.opacity(0.20), radius: 28, y: 14)
                .scaleEffect(isListening && pulse ? 1.04 : 1.0)
                .animation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true), value: isListening)

            Image(systemName: isListening ? "waveform.circle.fill" : "mic.fill")
                .font(.system(size: 44, weight: .medium))
                .foregroundStyle(AppTheme.surface)
        }
    }
}

#Preview {
    VoiceOrbView(isListening: true)
        .padding()
        .background(AppTheme.pageBackground)
}
