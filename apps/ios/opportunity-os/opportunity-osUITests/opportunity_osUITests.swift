import XCTest

final class opportunity_osUITests: XCTestCase {
    private enum LaunchState: String {
        case fresh
        case signedIn = "signed_in"
        case signedOut = "signed_out"
    }

    private struct OnboardingScript {
        let name: String
        let spokenTurns: [String]
        let email: String
        let password: String
        let voicePreference: String
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
    }

    private func identifiedElement(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func configuredApp(
        for state: LaunchState,
        spokenTurns: [String] = [],
        useRealAI: Bool = false
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TEST_MODE"] = "1"
        app.launchEnvironment["UI_TEST_AUTH_STATE"] = state.rawValue
        app.launchEnvironment["UI_TEST_SUITE"] = "opportunity-os-ui-tests.\(name.replacingOccurrences(of: " ", with: "-"))"
        if !spokenTurns.isEmpty,
           let data = try? JSONSerialization.data(withJSONObject: spokenTurns),
           let encoded = String(data: data, encoding: .utf8) {
            app.launchEnvironment["UI_TEST_SPOKEN_TURNS"] = encoded
        }
        if useRealAI {
            app.launchEnvironment["UI_TEST_USE_REAL_AI"] = "1"
        }
        return app
    }

    private func waitForElement(
        _ element: XCUIElement,
        timeout: TimeInterval = 20,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(
            element.waitForExistence(timeout: timeout),
            "Expected element to appear: \(element)",
            file: file,
            line: line
        )
    }

    @MainActor
    private func runVoiceOrbOnboarding(script: OnboardingScript, file: StaticString = #filePath, line: UInt = #line) throws {
        let app = configuredApp(
            for: .fresh,
            spokenTurns: [
                script.spokenTurns[0],
                script.email,
                script.password,
                script.voicePreference
            ],
            useRealAI: true
        )

        app.launch()

        let getStartedButton = app.buttons["Get Started"]
        waitForElement(getStartedButton, file: file, line: line)
        getStartedButton.tap()

        waitForElement(identifiedElement("screen.goalDiscovery", in: app), file: file, line: line)

        let continueWithPlanButton = app.buttons["Continue With This Plan"]
        waitForElement(continueWithPlanButton, timeout: 30, file: file, line: line)
        XCTAssertTrue(continueWithPlanButton.isEnabled, file: file, line: line)
        continueWithPlanButton.tap()

        waitForElement(identifiedElement("screen.emailEntry", in: app), file: file, line: line)
        let emailContinueButton = app.buttons["Continue"]
        waitForElement(emailContinueButton, timeout: 20, file: file, line: line)
        XCTAssertTrue(emailContinueButton.isEnabled, file: file, line: line)
        emailContinueButton.tap()

        waitForElement(identifiedElement("screen.passwordEntry", in: app), file: file, line: line)
        let passwordContinueButton = app.buttons["Create Account"].firstMatch
        waitForElement(passwordContinueButton, timeout: 20, file: file, line: line)
        XCTAssertTrue(passwordContinueButton.isEnabled, file: file, line: line)
        passwordContinueButton.tap()

        waitForElement(identifiedElement("screen.voiceSetup", in: app), file: file, line: line)
        let reviewFirstCycleButton = app.buttons["Review First Cycle"]
        waitForElement(reviewFirstCycleButton, timeout: 20, file: file, line: line)
        reviewFirstCycleButton.tap()

        waitForElement(identifiedElement("screen.firstCycleLaunch", in: app), file: file, line: line)
        let enterOpportunityOSButton = app.buttons["Enter Opportunity OS"]
        waitForElement(enterOpportunityOSButton, file: file, line: line)
        enterOpportunityOSButton.tap()

        waitForElement(identifiedElement("screen.home", in: app), timeout: 20, file: file, line: line)
    }

    @MainActor
    private func runVoiceToEmailCapture(script: OnboardingScript, file: StaticString = #filePath, line: UInt = #line) throws {
        let app = configuredApp(
            for: .fresh,
            spokenTurns: [
                script.spokenTurns[0],
                script.email
            ],
            useRealAI: true
        )

        app.launch()

        let getStartedButton = app.buttons["Get Started"]
        waitForElement(getStartedButton, file: file, line: line)
        getStartedButton.tap()

        waitForElement(identifiedElement("screen.goalDiscovery", in: app), file: file, line: line)

        let continueWithPlanButton = app.buttons["Continue With This Plan"]
        waitForElement(continueWithPlanButton, timeout: 30, file: file, line: line)
        XCTAssertTrue(continueWithPlanButton.isEnabled, "\(script.name): plan should be ready", file: file, line: line)
        continueWithPlanButton.tap()

        waitForElement(identifiedElement("screen.emailEntry", in: app), file: file, line: line)
        let capturedEmail = identifiedElement("onboarding.email", in: app)
        waitForElement(capturedEmail, file: file, line: line)

        let expectedEmail = script.email
            .lowercased()
            .replacingOccurrences(of: " at ", with: "@")
            .replacingOccurrences(of: " at", with: "@")
            .replacingOccurrences(of: " dot ", with: ".")
            .replacingOccurrences(of: " dot", with: ".")
            .replacingOccurrences(of: " underscore ", with: "_")
            .replacingOccurrences(of: " dash ", with: "-")
            .replacingOccurrences(of: " ", with: "")

        XCTAssertTrue(
            capturedEmail.staticTexts[expectedEmail].waitForExistence(timeout: 8),
            "\(script.name): expected captured email '\(expectedEmail)'",
            file: file,
            line: line
        )

        let emailContinueButton = app.buttons["Continue"]
        waitForElement(emailContinueButton, timeout: 20, file: file, line: line)
        XCTAssertTrue(emailContinueButton.isEnabled, "\(script.name): email continue should be enabled", file: file, line: line)
    }

    private var onboardingScripts: [OnboardingScript] {
        [
            OnboardingScript(
                name: "contract-direct-email",
                spokenTurns: [
                    "I want contract opportunities with CTOs for AI platform work."
                ],
                email: "jeff@example.com",
                password: "supersecret123",
                voicePreference: "voice first with a calm Canadian voice"
            ),
            OnboardingScript(
                name: "consulting-spoken-email",
                spokenTurns: [
                    "I want consulting clients in fintech who need help modernizing product delivery and AI operations."
                ],
                email: "consulting at example dot com",
                password: "supersecret123",
                voicePreference: "voice first with a warm British female voice"
            ),
            OnboardingScript(
                name: "job-search-direct-email",
                spokenTurns: [
                    "I am looking for staff product leadership roles at AI infrastructure companies in Toronto or remote."
                ],
                email: "jobs@example.com",
                password: "supersecret123",
                voicePreference: "voice first with a steady American voice"
            ),
            OnboardingScript(
                name: "advisory-spoken-email",
                spokenTurns: [
                    "I want advisory work with SaaS founders who are redesigning their AI product strategy."
                ],
                email: "jeff boggs at example dot com",
                password: "supersecret123",
                voicePreference: "touch first with a British female voice"
            ),
            OnboardingScript(
                name: "pipeline-ambiguous-opener",
                spokenTurns: [
                    "I need more pipeline."
                ],
                email: "pipeline at example dot com",
                password: "supersecret123",
                voicePreference: "voice first with a calm voice"
            ),
        ]
    }

    @MainActor
    func testVoiceOrbOnboardingWithRealAI() throws {
        try runVoiceOrbOnboarding(
            script: onboardingScripts[0]
        )
    }

    @MainActor
    func testVoiceOrbOnboardingWithConsultingScript() throws {
        try runVoiceOrbOnboarding(
            script: onboardingScripts[1]
        )
    }

    @MainActor
    func testVoiceOrbOnboardingWithJobSearchScript() throws {
        try runVoiceOrbOnboarding(
            script: onboardingScripts[2]
        )
    }

    @MainActor
    func testVoiceToEmailCaptureWithAdvisoryScript() throws {
        try runVoiceToEmailCapture(script: onboardingScripts[3])
    }

    @MainActor
    func testVoiceToEmailCaptureWithAmbiguousOpener() throws {
        try runVoiceToEmailCapture(script: onboardingScripts[4])
    }

    @MainActor
    func testVoiceToEmailCaptureWithSpokenEmailNormalization() throws {
        try runVoiceToEmailCapture(script: onboardingScripts[1])
    }
}
