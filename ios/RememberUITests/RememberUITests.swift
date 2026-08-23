import XCTest

@MainActor
final class RememberUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCoreNavigationAndCaptureValidation() throws {
        let app = makeApp()
        app.launch()
        XCTAssertTrue(app.staticTexts["Your memory"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Remember"].exists)
        app.tabBars.buttons["Library"].tap()
        XCTAssertTrue(app.staticTexts["Library"].exists)
        XCTAssertFalse(app.navigationBars["Library"].exists)
        app.buttons["Save something"].tap()
        XCTAssertTrue(app.navigationBars["Capture"].waitForExistence(timeout: 2))
        let field = app.textFields["Link to save"]
        field.tap()
        field.typeText("not-a-link")
        app.buttons["Save now"].tap()
        XCTAssertTrue(app.staticTexts["Enter a complete http or https link."].exists)
    }

    func testSignedOutOwnerSeesPrivateArchiveLogin() throws {
        let app = XCUIApplication()
        app.launchEnvironment["REMEMBER_API_URL"] = "http://127.0.0.1:1"
        app.launchEnvironment["REMEMBER_MOCK_FALLBACK"] = "0"
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launch()

        XCTAssertTrue(app.staticTexts["What shaped you,\nkept close."].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.buttons["Enter your archive"].exists)
    }

    func testAskProvidesGroundedCitations() throws {
        let app = makeApp()
        app.launch()
        app.tabBars.buttons["Ask"].tap()
        app.buttons["What themes keep appearing?"].tap()
        XCTAssertTrue(app.staticTexts["Grounded in your library"].waitForExistence(timeout: 4))
    }

    func testHomePassesSystemAccessibilityAudit() throws {
        let app = makeApp()
        app.launch()
        XCTAssertTrue(app.staticTexts["Your memory"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Remember"].exists)
        app.swipeDown(velocity: .fast)
        try app.performAccessibilityAudit(for: [.elementDetection, .hitRegion, .sufficientElementDescription, .textClipped, .trait])
    }

    func testHomeAtLargestDynamicTypeRemainsNavigable() throws {
        let app = makeApp()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Your memory"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Remember"].exists)
        XCTAssertTrue(app.buttons["Save something"].isHittable)
    }

    func testLibraryLastItemClearsFloatingTabBar() throws {
        let app = makeApp()
        app.launchEnvironment["REMEMBER_INITIAL_TAB"] = "library"
        app.launch()
        XCTAssertTrue(app.staticTexts["Library"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Library"].exists)

        let lastItem = app.staticTexts["A link waiting for another try"]
        for _ in 0..<8 where !lastItem.isHittable {
            app.swipeUp()
        }

        XCTAssertTrue(lastItem.isHittable)
    }

    private func makeApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["REMEMBER_API_URL"] = "http://127.0.0.1:1"
        app.launchEnvironment["REMEMBER_MOCK_FALLBACK"] = "1"
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        return app
    }
}
