import XCTest

final class opportunity_osUITests: XCTestCase {
    private enum LaunchState: String {
        case fresh
        case signedIn = "signed_in"
        case signedOut = "signed_out"
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
    func testVoiceOrbOnboardingWithRealAI() throws {
        let app = configuredApp(
            for: .fresh,
            spokenTurns: [
                "I want contract opportunities with CTOs for AI platform work.",
                "jeff@example.com",
                "supersecret123",
                "voice first with a calm Canadian voice"
            ],
            useRealAI: true
        )

        app.launch()

        let getStartedButton = app.buttons["Get Started"]
        waitForElement(getStartedButton)
        getStartedButton.tap()

        waitForElement(identifiedElement("screen.goalDiscovery", in: app))

        let continueWithPlanButton = app.buttons["Continue With This Plan"]
        waitForElement(continueWithPlanButton, timeout: 30)
        XCTAssertTrue(continueWithPlanButton.isEnabled)
        continueWithPlanButton.tap()

        waitForElement(identifiedElement("screen.emailEntry", in: app))
        let emailContinueButton = app.buttons["Continue"]
        waitForElement(emailContinueButton, timeout: 20)
        XCTAssertTrue(emailContinueButton.isEnabled)
        emailContinueButton.tap()

        waitForElement(identifiedElement("screen.passwordEntry", in: app))
        let passwordContinueButton = app.buttons["Create Account"].firstMatch
        waitForElement(passwordContinueButton, timeout: 20)
        XCTAssertTrue(passwordContinueButton.isEnabled)
        passwordContinueButton.tap()

        waitForElement(identifiedElement("screen.voiceSetup", in: app))
        let reviewFirstCycleButton = app.buttons["Review First Cycle"]
        waitForElement(reviewFirstCycleButton, timeout: 20)
        reviewFirstCycleButton.tap()

        waitForElement(identifiedElement("screen.firstCycleLaunch", in: app))
        let enterOpportunityOSButton = app.buttons["Enter Opportunity OS"]
        waitForElement(enterOpportunityOSButton)
        enterOpportunityOSButton.tap()

        waitForElement(identifiedElement("screen.home", in: app), timeout: 20)
    }
}
