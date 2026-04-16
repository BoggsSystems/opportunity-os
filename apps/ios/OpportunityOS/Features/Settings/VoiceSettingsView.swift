import SwiftUI

struct VoiceSettingsView: View {
    @StateObject var viewModel: VoiceSettingsViewModel

    var body: some View {
        Form {
            Section("Current Voice") {
                Text(viewModel.preference.displayName)
                Text(viewModel.preference.styleDescription)
                    .foregroundStyle(AppTheme.mutedText)
            }

            Section("Natural Language Command") {
                TextField("Describe the voice you want", text: $viewModel.naturalLanguageRequest, axis: .vertical)
                Button("Use Voice Request") {
                    viewModel.captureVoiceRequest()
                }
                Button("Apply Request") {
                    Task { await viewModel.applyNaturalLanguageRequest() }
                }
            }

            if !viewModel.transcript.isEmpty {
                Section("Captured Transcript") {
                    Text(viewModel.transcript)
                }
            }

            Section {
                Button("Play Sample") {
                    viewModel.sampleVoice()
                }
            }
        }
        .navigationTitle("Voice Settings")
        .task {
            await viewModel.load()
        }
    }
}
