import SwiftUI

struct VoiceModeSetupView: View {
    @StateObject var viewModel: VoiceModeSetupViewModel
    let onContinue: () -> Void

    var body: some View {
        Form {
            Section("Interaction Mode") {
                Picker("Mode", selection: $viewModel.interactionMode) {
                    ForEach(InteractionMode.allCases, id: \.self) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Voice") {
                Text(viewModel.voicePreference.displayName)
                Text(viewModel.voicePreference.styleDescription)
                    .foregroundStyle(AppTheme.mutedText)

                Button("Play Voice Sample") {
                    viewModel.playSample()
                }
            }

            Section {
                Button("Enter Opportunity OS") {
                    Task {
                        await viewModel.confirmSetup()
                        onContinue()
                    }
                }
            }
        }
        .navigationTitle("Voice Setup")
        .task {
            await viewModel.load()
        }
    }
}
