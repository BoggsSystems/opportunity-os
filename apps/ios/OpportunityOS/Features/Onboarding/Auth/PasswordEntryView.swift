import SwiftUI

struct PasswordEntryView: View {
    @StateObject var viewModel: PasswordEntryViewModel
    let onAuthenticated: () -> Void

    var body: some View {
        Form {
            Section("Password") {
                SecureField("Password", text: $viewModel.password)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }

            Section {
                Button(viewModel.isLoading ? "Signing In..." : "Continue") {
                    Task {
                        if await viewModel.signIn() {
                            onAuthenticated()
                        }
                    }
                }
                .disabled(viewModel.password.count < 6 || viewModel.isLoading)
            }
        }
        .navigationTitle("Password")
    }
}
