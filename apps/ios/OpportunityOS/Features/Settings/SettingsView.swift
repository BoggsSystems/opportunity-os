import SwiftUI

struct SettingsView: View {
    @StateObject var viewModel: SettingsViewModel
    let onOpenVoiceSettings: () -> Void
    let onSignOut: () -> Void

    var body: some View {
        Form {
            Section("Account") {
                Text(viewModel.currentEmail)
                Text(viewModel.currentMode.title)
                    .foregroundStyle(AppTheme.mutedText)
            }

            Section("Preferences") {
                Button("Voice Settings", action: onOpenVoiceSettings)
            }

            Section {
                Button("Sign Out", role: .destructive, action: onSignOut)
            }
        }
        .navigationTitle("Settings")
    }
}
