import SwiftUI

struct VoiceSettingsView: View {
    @StateObject var viewModel: VoiceSettingsViewModel

    var body: some View {
        Form {
            Section("Current Voice") {
                Text(viewModel.preference.displayName)
                    .foregroundStyle(AppTheme.primaryText)
                Text(viewModel.preference.styleDescription)
                    .foregroundStyle(AppTheme.mutedText)
            }

            Section("Natural Language Command") {
                TextField("Describe the voice you want", text: $viewModel.naturalLanguageRequest, axis: .vertical)
                    .accessibilityIdentifier("voiceSettings.request")
                Button("Use Voice Request") {
                    viewModel.captureVoiceRequest()
                }
                .accessibilityIdentifier("voiceSettings.useVoiceRequest")
                Button("Apply Request") {
                    Task { await self.viewModel.applyNaturalLanguageRequest() }
                }
                .accessibilityIdentifier("voiceSettings.applyRequest")
            }

            if !viewModel.transcript.isEmpty {
                Section("Captured Transcript") {
                    Text(viewModel.transcript)
                        .foregroundStyle(AppTheme.primaryText)
                }
            }

            Section {
                Button("Play Sample") {
                    viewModel.sampleVoice()
                }
                .accessibilityIdentifier("voiceSettings.playSample")
            }
        }
        .navigationTitle("Voice Settings")
        .scrollContentBackground(.hidden)
        .background(AppTheme.pageBackground)
        .accessibilityIdentifier("screen.voiceSettings")
        .task {
            await self.viewModel.load()
        }
    }
}
