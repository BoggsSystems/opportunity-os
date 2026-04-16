import SwiftUI

struct VoiceConversationView: View {
    @StateObject var viewModel: VoiceConversationViewModel

    var body: some View {
        VStack(spacing: 20) {
            VoiceOrbView(isListening: viewModel.isListening)

            Text(viewModel.assistantResponse)
                .font(.title3)
                .multilineTextAlignment(.center)

            Text(viewModel.transcript.isEmpty ? "Tap the orb to start speaking." : viewModel.transcript)
                .foregroundStyle(AppTheme.mutedText)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button(viewModel.isListening ? "Stop Listening" : "Start Listening") {
                    viewModel.toggleListening()
                }
                .buttonStyle(.borderedProminent)

                Button("Speak Reply") {
                    viewModel.speakResponse()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
}
