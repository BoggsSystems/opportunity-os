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
                            .accessibilityIdentifier("messageDraft.subject")

                        Text(draft.body)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.card, in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(AppTheme.border))
                            .foregroundStyle(AppTheme.primaryText)

                        HStack {
                            Button("Read Aloud") {
                                viewModel.speakDraft()
                            }
                            .buttonStyle(.bordered)
                            .tint(AppTheme.accent)
                            .accessibilityIdentifier("messageDraft.readAloud")

                            Button("Continue to Send") {
                                onContinue(draft)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(AppTheme.accent)
                            .accessibilityIdentifier("messageDraft.continueToSend")
                        }
                    }
                    .padding()
                }
            } else if viewModel.isLoading {
                ProgressView("Drafting message...")
                    .accessibilityIdentifier("messageDraft.loading")
            } else {
                Text("No draft available.")
                    .foregroundStyle(AppTheme.mutedText)
                    .accessibilityIdentifier("messageDraft.empty")
            }
        }
        .background(AppTheme.pageBackground.ignoresSafeArea())
        .navigationTitle("Message Draft")
        .accessibilityIdentifier("screen.messageDraft")
        .task {
            await self.viewModel.load()
        }
    }
}
