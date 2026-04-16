import SwiftUI

struct MessageDraftView: View {
    @StateObject var viewModel: MessageDraftViewModel
    let onContinue: (OutreachMessage) -> Void

    var body: some View {
        Group {
            if let draft = viewModel.draft {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        TextField("Subject", text: .constant(draft.subject))
                            .textFieldStyle(.roundedBorder)

                        Text(draft.body)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 18))

                        HStack {
                            Button("Read Aloud") {
                                viewModel.speakDraft()
                            }
                            .buttonStyle(.bordered)

                            Button("Continue to Send") {
                                onContinue(draft)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(AppTheme.accent)
                        }
                    }
                    .padding()
                }
            } else if viewModel.isLoading {
                ProgressView("Drafting message...")
            } else {
                Text("No draft available.")
            }
        }
        .background(AppTheme.background.ignoresSafeArea())
        .foregroundStyle(Color.white)
        .navigationTitle("Message Draft")
        .task {
            await viewModel.load()
        }
    }
}
