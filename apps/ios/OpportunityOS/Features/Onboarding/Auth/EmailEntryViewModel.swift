import Foundation

@MainActor
final class EmailEntryViewModel: ObservableObject {
    @Published var email = ""

    var isValid: Bool {
        email.contains("@") && email.contains(".")
    }
}
