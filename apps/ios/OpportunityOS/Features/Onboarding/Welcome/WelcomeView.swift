import SwiftUI

struct WelcomeView: View {
    @StateObject var viewModel: WelcomeViewModel
    let onContinue: () -> Void

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()

                VoiceOrbView(isListening: false)

                VStack(spacing: 14) {
                    Text("Opportunity OS")
                        .font(.largeTitle.weight(.bold))
                    Text(viewModel.greeting)
                        .font(.title3)
                        .foregroundStyle(AppTheme.mutedText)
                        .multilineTextAlignment(.center)
                }

                Button("Hear Greeting") {
                    viewModel.playGreeting()
                }
                .buttonStyle(.bordered)

                Spacer()

                Button("Get Started", action: onContinue)
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)
            }
            .padding(24)
            .foregroundStyle(Color.white)
        }
    }
}
