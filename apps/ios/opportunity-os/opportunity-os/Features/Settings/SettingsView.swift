import SwiftUI

struct SettingsView: View {
    @StateObject var viewModel: SettingsViewModel
    let onOpenVoiceSettings: () -> Void
    let onSignOut: () -> Void

    var body: some View {
        Form {
            Section("Account") {
                Text(viewModel.currentEmail)
                    .foregroundStyle(AppTheme.primaryText)
                Text(viewModel.currentMode.title)
                    .foregroundStyle(AppTheme.mutedText)
            }

            Section("Preferences") {
                Button("Voice Settings", action: onOpenVoiceSettings)
                    .accessibilityIdentifier("settings.voiceSettings")
            }

            Section {
                Button("Sign Out", role: .destructive, action: onSignOut)
                    .accessibilityIdentifier("settings.signOut")
            }
        }
        .navigationTitle("Settings")
        .scrollContentBackground(.hidden)
        .background(AppTheme.pageBackground)
        .accessibilityIdentifier("screen.settings")
    }
}
