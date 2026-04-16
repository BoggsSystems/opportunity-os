import SwiftUI

struct EmailEntryView: View {
    @StateObject var viewModel: EmailEntryViewModel
    let onContinue: (String) -> Void

    var body: some View {
        Form {
            Section("Email") {
                TextField("name@company.com", text: $viewModel.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
            }

            Section {
                Button("Continue") {
                    onContinue(viewModel.email)
                }
                .disabled(!viewModel.isValid)
            }
        }
        .navigationTitle("Email")
    }
}
