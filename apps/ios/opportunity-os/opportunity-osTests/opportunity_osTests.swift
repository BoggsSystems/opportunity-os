import XCTest
@testable import opportunity_os

@MainActor
final class opportunity_osTests: XCTestCase {
    func testEmailEntryValidationRequiresEmailLikeInput() {
        let viewModel = EmailEntryViewModel(
            mode: .signUp,
            speechRecognitionService: StubSpeechRecognitionService(),
            speechSynthesisService: StubSpeechSynthesisService()
        )

        viewModel.email = "invalid"
        XCTAssertFalse(viewModel.isValid)

        viewModel.email = "jeff@example.com"
        XCTAssertTrue(viewModel.isValid)
    }

    func testPasswordEntrySubmitCreatesSession() async {
        let suiteName = "opportunity-os-tests.password-submit.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        let sessionManager = SessionManager(defaults: defaults)
        let viewModel = PasswordEntryViewModel(
            email: "jeff@example.com",
            mode: .signIn,
            authService: StubAuthService(),
            sessionManager: sessionManager,
            speechRecognitionService: StubSpeechRecognitionService(),
            speechSynthesisService: StubSpeechSynthesisService()
        )

        viewModel.password = "supersecret123"
        let didSubmit = await viewModel.submit()

        XCTAssertTrue(didSubmit)
        XCTAssertEqual(sessionManager.session?.user.email, "jeff@example.com")
        XCTAssertNil(viewModel.errorMessage)
    }

    func testStubSpeechRecognitionConsumesScriptedTurns() async throws {
        let seedInput = "[\"first turn\",\"second turn\"]"
        let service = StubSpeechRecognitionService(seedInput: seedInput)

        let first = try await service.listenForUtterance()
        let second = try await service.listenForUtterance()
        let repeatedLast = try await service.listenForUtterance()

        XCTAssertEqual(first, "first turn")
        XCTAssertEqual(second, "second turn")
        XCTAssertEqual(repeatedLast, "second turn")
    }

    func testVoiceModeSetupParsesSpokenPreferences() async {
        let suiteName = "opportunity-os-tests.voice-setup.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        let sessionManager = SessionManager(defaults: defaults)
        let voicePreferenceService = StubVoicePreferenceService()
        let viewModel = VoiceModeSetupViewModel(
            sessionManager: sessionManager,
            voicePreferenceService: voicePreferenceService,
            speechSynthesisService: StubSpeechSynthesisService(),
            speechRecognitionService: StubSpeechRecognitionService()
        )

        await viewModel.load()
        viewModel.transcript = "touch first with a british female voice"
        await viewModel.applySpokenPreferences()

        XCTAssertEqual(viewModel.interactionMode, .touchFirst)
        XCTAssertEqual(viewModel.voicePreference.localeIdentifier, "en-GB")
        XCTAssertEqual(viewModel.voicePreference.displayName, "Avery")
    }
}
