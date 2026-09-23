import XCTest

@MainActor
final class RememberUITests: XCTestCase {
    private let timeout: TimeInterval = 8
    private let primaryTabs = ["Today", "Plan", "Library", "Ask", "Life"]
    private let primaryTabIdentifiers = [
        "remember.tab.today",
        "remember.tab.plan",
        "remember.tab.library",
        "remember.tab.ask",
        "remember.tab.life"
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testTodayShowsOneSuggestedTaskAndPlanNavigation() {
        let app = makeApp()
        app.launch()
        let start = app.buttons["Do this now"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        XCTAssertTrue(start.isHittable)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Focused Today"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        selectPrimaryTab("Plan", in: app)
        XCTAssertTrue(app.navigationBars["Plan"].waitForExistence(timeout: timeout))
    }

    func testPrimaryNavigationHasExactlyFiveTabsAndNoMore() {
        let app = makeApp()
        app.launch()

        let tabBar = shellTabBar(in: app)
        let visibleTabs = tabBar.buttons.allElementsBoundByIndex.map(\.label)

        XCTAssertEqual(visibleTabs, primaryTabs)
        XCTAssertEqual(tabBar.buttons.count, 5)
        XCTAssertFalse(tabBar.buttons["More"].exists)
        XCTAssertTrue(waitForSelection(tabBar.buttons["Today"]))
        for identifier in primaryTabIdentifiers {
            XCTAssertTrue(
                app.descendants(matching: .any)[identifier].exists,
                "Missing stable tab identifier \(identifier)."
            )
        }
    }

    func testPlanLibraryAndLifeSectionsSwitchInPlace() {
        let app = makeApp()
        app.launch()

        selectPrimaryTab("Plan", in: app)
        assertSectionPicker("remember.section.plan", labels: ["Tasks", "Calendar", "Goals"], selected: "Tasks", in: app)
        selectSection("Calendar", screenTitle: "Calendar", in: app)
        selectSection("Goals", screenTitle: "Goals", in: app)

        selectPrimaryTab("Library", in: app)
        assertSectionPicker("remember.section.library", labels: ["Saved", "Patterns"], selected: "Saved", in: app)
        selectSection("Patterns", screenTitle: "Patterns", in: app)

        selectPrimaryTab("Life", in: app)
        assertSectionPicker("remember.section.life", labels: ["Health", "Money", "Files"], selected: "Health", in: app)
        selectSection("Money", screenTitle: "Money", in: app)
        selectSection("Files", screenTitle: "Files", in: app)
    }

    func testGlobalSaveAndSettingsOpenAndDismissFromSecondaryTabs() {
        let app = makeApp()
        app.launch()

        selectPrimaryTab("Library", in: app)
        let saveButton = app.buttons["Save a link or thought"]
        XCTAssertTrue(saveButton.waitForExistence(timeout: timeout))
        XCTAssertTrue(saveButton.isHittable)
        saveButton.tap()

        let captureBar = app.navigationBars["Save something"]
        XCTAssertTrue(captureBar.waitForExistence(timeout: timeout))
        let linkField = app.textFields["Link to save"]
        XCTAssertTrue(linkField.exists)
        XCTAssertTrue(linkField.isHittable)
        linkField.tap()
        linkField.typeText("not-a-link")
        app.buttons["Save link"].tap()
        XCTAssertTrue(app.staticTexts["Enter a complete https link."].waitForExistence(timeout: timeout))
        captureBar.buttons["Cancel"].tap()
        XCTAssertTrue(captureBar.waitForNonExistence(timeout: timeout))

        selectPrimaryTab("Life", in: app)
        let profileButton = app.buttons["remember.global.settings"]
        XCTAssertTrue(profileButton.waitForExistence(timeout: timeout))
        XCTAssertTrue(profileButton.isHittable)
        profileButton.tap()

        let settingsBar = app.navigationBars["Settings"]
        XCTAssertTrue(settingsBar.waitForExistence(timeout: timeout))
        let doneButton = settingsBar.buttons["Done"]
        XCTAssertTrue(doneButton.isHittable)
        doneButton.tap()
        XCTAssertTrue(settingsBar.waitForNonExistence(timeout: timeout))
        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Life"]))
    }

    func testSavingAThoughtMakesItPartOfTheLibraryWithoutAskingForALink() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        let saveButton = app.buttons["Save a link or thought"]
        XCTAssertTrue(saveButton.waitForExistence(timeout: timeout))
        saveButton.tap()

        let captureBar = app.navigationBars["Save something"]
        XCTAssertTrue(captureBar.waitForExistence(timeout: timeout))
        let thoughtChoice = app.segmentedControls.buttons["Thought"]
        XCTAssertTrue(thoughtChoice.waitForExistence(timeout: timeout))
        thoughtChoice.tap()

        let thought = "A slower start helps me choose the day instead of inherit it"
        let thoughtField = app.textFields["Thought to remember"]
        XCTAssertTrue(thoughtField.waitForExistence(timeout: timeout))
        thoughtField.tap()
        thoughtField.typeText(thought)
        attachScreenshot(of: app, named: "Quick Thought composer")

        let saveThought = app.buttons["Save thought"]
        XCTAssertTrue(waitForEnabled(saveThought))
        saveThought.tap()
        XCTAssertTrue(app.staticTexts["Saved"].waitForExistence(timeout: timeout))
        app.buttons["Done"].tap()

        XCTAssertTrue(captureBar.waitForNonExistence(timeout: timeout))
        let savedThought = app.staticTexts[thought]
        XCTAssertTrue(savedThought.waitForExistence(timeout: timeout))
        attachScreenshot(of: app, named: "Quick Thought in Library")

        savedThought.tap()
        XCTAssertTrue(app.navigationBars["Saved item"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Your words")).firstMatch.exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Remember’s reflection")).firstMatch.exists)
        XCTAssertFalse(app.buttons["Open original"].exists)
        attachScreenshot(of: app, named: "Quick Thought detail")
    }

    func testReturnedIdeaLearnsWhatStillBelongsToTheUser() {
        let app = makeApp()
        app.launch()

        app.buttons["remember.today.savedIdeas"].tap()
        let getUnstuck = app.buttons["Get unstuck"]
        scrollUntilHittable(getUnstuck, in: app)
        XCTAssertTrue(getUnstuck.isHittable)
        getUnstuck.tap()

        let checkIn = app.staticTexts["Where does this land now?"]
        scrollGentlyUntilHittable(checkIn, in: app)
        XCTAssertTrue(checkIn.waitForExistence(timeout: timeout))
        XCTAssertTrue(checkIn.isHittable)
        XCTAssertTrue(app.buttons["remember.memory-check-in.still_true"].exists)
        XCTAssertTrue(app.buttons["remember.memory-check-in.changed_mind"].exists)
        XCTAssertTrue(app.buttons["remember.memory-check-in.not_sure"].exists)
        XCTAssertTrue(app.buttons["remember.memory-check-in.no_longer_relevant"].exists)
        attachScreenshot(of: app, named: "Memory check-in choices")

        let changed = app.buttons["remember.memory-check-in.changed_mind"]
        scrollUntilHittable(changed, in: app)
        changed.tap()
        XCTAssertTrue(app.staticTexts["Your change of mind is part of the story."].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Remember will use this as evidence of how your thinking has evolved."].exists)
        attachScreenshot(of: app, named: "Memory check-in learned")

        let compass = app.buttons["remember.memory-check-in.compass"]
        scrollUntilHittable(compass, in: app)
        compass.tap()
        XCTAssertTrue(app.navigationBars["Patterns"].waitForExistence(timeout: timeout))
    }

    func testReleasedReturnKeepsItsAcknowledgementThenLetsAnotherIdeaStartFresh() {
        let app = makeApp()
        app.launch()

        app.buttons["remember.today.savedIdeas"].tap()
        let getUnstuck = app.buttons["remember.today.need.stuck"]
        scrollUntilHittable(getUnstuck, in: app)
        getUnstuck.tap()
        let release = app.buttons["remember.memory-check-in.no_longer_relevant"]
        scrollGentlyUntilHittable(release, in: app)
        XCTAssertTrue(release.isHittable)
        release.tap()

        let acknowledgement = app.staticTexts["Released from your current guidance."]
        XCTAssertTrue(acknowledgement.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Remember will stop bringing this back as something you should follow."].exists)
        attachScreenshot(of: app, named: "Released return acknowledgement")

        let done = app.buttons["remember.today.return.done"]
        scrollGentlyUntilHittable(done, in: app)
        done.tap()
        XCTAssertTrue(app.staticTexts["Nothing waiting for this moment yet"].waitForExistence(timeout: timeout))
        XCTAssertFalse(app.buttons["remember.memory-check-in.still_true"].exists)

        let focus = app.buttons["remember.today.need.focus"]
        for _ in 0..<8 where !focus.isHittable { app.swipeDown() }
        focus.tap()
        let freshCheckIn = app.buttons["remember.memory-check-in.still_true"]
        scrollGentlyUntilHittable(freshCheckIn, in: app)
        XCTAssertTrue(freshCheckIn.isHittable)
        XCTAssertFalse(acknowledgement.exists)
        attachScreenshot(of: app, named: "Next return starts with a fresh check-in")
    }

    func testLegacyLaunchRouteAliasesOpenTheirCompatibleDestination() {
        let routes = [
            LegacyRoute(name: "tasks", primaryTab: "Plan", section: "Tasks", screenTitle: "Plan"),
            LegacyRoute(name: "calendar", primaryTab: "Plan", section: "Calendar", screenTitle: "Calendar"),
            LegacyRoute(name: "goals", primaryTab: "Plan", section: "Goals", screenTitle: "Goals"),
            LegacyRoute(name: "health", primaryTab: "Life", section: "Health", screenTitle: "Health"),
            LegacyRoute(name: "money", primaryTab: "Life", section: "Money", screenTitle: "Money"),
            LegacyRoute(name: "files", primaryTab: "Life", section: "Files", screenTitle: "Files"),
            LegacyRoute(name: "evolution", primaryTab: "Library", section: "Patterns", screenTitle: "Patterns")
        ]

        for route in routes {
            assertLegacyRoute(route)
        }

        let settingsApp = makeApp(initialRoute: "settings")
        settingsApp.launch()
        XCTAssertTrue(settingsApp.navigationBars["Settings"].waitForExistence(timeout: timeout))
        settingsApp.navigationBars["Settings"].buttons["Done"].tap()
        XCTAssertTrue(settingsApp.navigationBars["Settings"].waitForNonExistence(timeout: timeout))
        XCTAssertTrue(waitForSelection(shellTabBar(in: settingsApp).buttons["Today"]))
        settingsApp.terminate()
    }

    func testTaskComposerSupportsAccessibleKeyboardEntryAndConfirmedSave() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        XCTAssertTrue(app.navigationBars["Plan"].waitForExistence(timeout: timeout))
        let addTask = app.buttons["Add task with details"]
        XCTAssertTrue(addTask.waitForExistence(timeout: timeout))
        XCTAssertTrue(addTask.isHittable)
        addTask.tap()

        let composerBar = app.navigationBars["Add task"]
        XCTAssertTrue(composerBar.waitForExistence(timeout: timeout))
        let titleField = app.textFields["Task name"]
        let submitButton = app.buttons["remember.task.submit"]

        XCTAssertTrue(titleField.exists)
        XCTAssertTrue(titleField.isHittable)
        XCTAssertFalse(submitButton.isEnabled)

        titleField.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: timeout))
        titleField.typeText("UI regression task")
        XCTAssertTrue(waitForEnabled(submitButton))

        submitButton.tap()
        XCTAssertTrue(composerBar.waitForNonExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["UI regression task"].waitForExistence(timeout: timeout))
    }

    func testTaskCanBeAddedFromTheBottomBarWithoutOpeningAForm() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        let quickEntry = app.textFields["Quick add task"]
        XCTAssertTrue(quickEntry.waitForExistence(timeout: timeout))
        quickEntry.tap()
        quickEntry.typeText("Send the short update")
        let add = app.buttons["remember.task.quickAction"]
        XCTAssertTrue(waitForEnabled(add))
        add.tap()

        XCTAssertTrue(app.staticTexts["Send the short update"].waitForExistence(timeout: timeout))
        XCTAssertFalse(app.navigationBars["Add task"].exists)
    }

    func testSwitchingTasksKeepsThePreviousTaskInPlan() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()
        app.buttons["Do this now"].tap()

        let quickEntry = app.textFields["Quick add task"]
        quickEntry.tap()
        quickEntry.typeText("Write a reply")
        app.buttons["remember.task.quickAction"].tap()

        let easier = app.buttons["Make this easier"]
        XCTAssertTrue(easier.waitForExistence(timeout: timeout))
        easier.tap()
        app.buttons["Choose another task"].tap()
        XCTAssertTrue(app.navigationBars["Choose another task"].waitForExistence(timeout: timeout))

        let alternative = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "Write a reply")
        ).firstMatch
        XCTAssertTrue(alternative.waitForExistence(timeout: timeout))
        alternative.tap()

        XCTAssertTrue(app.navigationBars["Choose another task"].waitForNonExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Write a reply"].waitForExistence(timeout: timeout))
        XCTAssertTrue(
            app.buttons["remember.life-task.60000000-0000-0000-0000-000000000001"].waitForExistence(timeout: timeout),
            "The previous task should still be available after switching."
        )
    }

    func testSignedOutOwnerSeesPrivateArchiveLogin() {
        let app = makeApp(mockFallback: false)
        app.launch()

        XCTAssertTrue(app.staticTexts["Welcome back"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.buttons["Sign in"].exists)
    }

    func testAskKeepsGroundingQuietlyAvailable() {
        let app = makeApp()
        app.launch()

        selectPrimaryTab("Ask", in: app)
        app.buttons["What have I saved about focus?"].tap()
        XCTAssertTrue(app.staticTexts["From your saves"].waitForExistence(timeout: timeout))
        let supportingSaves = app.buttons["Supporting saves"]
        XCTAssertTrue(supportingSaves.waitForExistence(timeout: timeout))
        supportingSaves.tap()
        let firstSource = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "Your worst years are not wasted years")
        ).firstMatch
        XCTAssertTrue(firstSource.waitForExistence(timeout: timeout))
    }

    func testAskTurnsAGroundedAnswerIntoAPlanExperiment() {
        let app = makeApp()
        app.launch()

        selectPrimaryTab("Ask", in: app)
        app.buttons["What have I saved about focus?"].tap()
        XCTAssertTrue(app.staticTexts["Put this to work"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Write one thing this season clarified, and one thing you are ready to release."].exists)

        let tryExperiment = app.buttons["Try this experiment"]
        scrollUntilHittable(tryExperiment, in: app)
        XCTAssertTrue(tryExperiment.isHittable)
        tryExperiment.tap()

        let addedToPlan = app.buttons["Added to Plan"]
        XCTAssertTrue(addedToPlan.waitForExistence(timeout: timeout))
        addedToPlan.tap()
        XCTAssertTrue(app.navigationBars["Plan"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Write one thing this season clarified, and one thing you are ready to release."].waitForExistence(timeout: timeout))
    }

    func testDecisionUsesSavedMemoryAndCreatesARealWorldTest() {
        let app = makeApp(initialRoute: "ask")
        app.launch()

        let decisionEntry = app.buttons["remember.ask.decision"]
        XCTAssertTrue(decisionEntry.waitForExistence(timeout: timeout))
        XCTAssertTrue(decisionEntry.isHittable)
        decisionEntry.tap()

        XCTAssertTrue(app.navigationBars["Decision"].waitForExistence(timeout: timeout))
        let decisionField = app.textFields["remember.decision.input"]
        XCTAssertTrue(decisionField.waitForExistence(timeout: timeout))
        decisionField.tap()
        decisionField.typeText("Should I protect more time for creative work?")

        let submit = app.buttons["remember.decision.submit"]
        XCTAssertTrue(waitForEnabled(submit))
        submit.tap()

        XCTAssertTrue(app.descendants(matching: .any)["remember.decision.result"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["What seems to matter"].exists)
        XCTAssertTrue(app.staticTexts["What pulls you toward it"].exists)

        let tryThis = app.buttons["remember.decision.try"]
        scrollUntilHittable(tryThis, in: app)
        XCTAssertTrue(tryThis.isHittable)
        tryThis.tap()
        XCTAssertTrue(app.buttons["Added to Plan"].waitForExistence(timeout: timeout))

        selectPrimaryTab("Plan", in: app)
        XCTAssertTrue(app.staticTexts["Should I protect more time for creative work"].waitForExistence(timeout: timeout))
    }

    func testLargestDynamicTypeKeepsGlobalActionsAndNavigationReachable() {
        let app = makeApp()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge"
        ]
        app.launch()

        let tabBar = shellTabBar(in: app)
        XCTAssertEqual(tabBar.buttons.count, 5)
        XCTAssertTrue(app.buttons["Save"].isHittable)
        XCTAssertTrue(app.buttons["Profile and settings"].isHittable)

        let dailyBasics = app.staticTexts["Daily basics"].firstMatch
        scrollUntilHittable(dailyBasics, in: app)
        XCTAssertTrue(dailyBasics.isHittable)
        XCTAssertLessThan(dailyBasics.frame.maxY, tabBar.frame.minY)

        selectPrimaryTab("Library", in: app)
        XCTAssertTrue(app.buttons["Saved"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.buttons["Patterns"].exists)
        XCTAssertTrue(app.buttons["Newest first"].exists)

        let firstSave = app.staticTexts["A link waiting for another try"]
        scrollUntilHittable(firstSave, in: app)
        XCTAssertTrue(firstSave.isHittable)
        XCTAssertLessThan(firstSave.frame.maxY, tabBar.frame.minY)

        selectPrimaryTab("Ask", in: app)
        let askField = app.textFields["Ask your library"]
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        XCTAssertTrue(askField.isHittable)
        let askButton = app.buttons["remember.ask.submit"]
        XCTAssertTrue(askButton.exists)
        XCTAssertLessThan(askButton.frame.maxY, tabBar.frame.minY)
    }

    func testLibraryLastItemRemainsReachableAboveTheTabBar() {
        let app = makeApp(initialRoute: "library")
        app.launch()
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: timeout))

        let lastItem = app.staticTexts["A link waiting for another try"]
        for _ in 0..<8 where !lastItem.isHittable {
            app.swipeUp()
        }

        XCTAssertTrue(lastItem.isHittable)
    }

    func testLibraryRowsRemainCompactAtDefaultDynamicType() {
        let app = makeApp(initialRoute: "library")
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryLarge"
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: timeout))

        let row = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "remember.library.imprint.")
        ).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        XCTAssertLessThan(row.frame.height, 180, "A default-size Library row should stay compact and adaptive.")
    }

    func testSavedExperimentCarriesForwardIntoPlan() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        let savedIdea = app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS %@", "Your worst years are not wasted years")
        ).firstMatch
        scrollUntilHittable(savedIdea, in: app)
        XCTAssertTrue(savedIdea.waitForExistence(timeout: timeout))
        XCTAssertTrue(savedIdea.isHittable)
        savedIdea.tap()

        XCTAssertTrue(app.navigationBars["Saved item"].waitForExistence(timeout: timeout))
        let tryThis = app.buttons["Try this"]
        scrollUntilHittable(tryThis, in: app)
        XCTAssertTrue(tryThis.isHittable)
        tryThis.tap()

        let addedToPlan = app.buttons["Added to Plan"]
        XCTAssertTrue(addedToPlan.waitForExistence(timeout: timeout))
        addedToPlan.tap()

        XCTAssertTrue(app.navigationBars["Plan"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Write one thing this season clarified, and one thing you are ready to release."].waitForExistence(timeout: timeout))
    }

    func testLivingThreadShowsChangeAndHandsTheQuestionToAsk() {
        let app = makeApp(initialRoute: "evolution")
        app.launch()

        XCTAssertTrue(app.navigationBars["Patterns"].waitForExistence(timeout: timeout))
        app.buttons["Threads"].tap()
        XCTAssertTrue(app.staticTexts["Ideas that keep finding you"].waitForExistence(timeout: timeout))
        let identity = app.descendants(matching: .any)["remember.thread.identity"]
        XCTAssertTrue(identity.waitForExistence(timeout: timeout))
        identity.tap()

        XCTAssertTrue(app.navigationBars["Identity"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Still unresolved"].exists)
        XCTAssertTrue(app.staticTexts["You left this open"].exists)
        XCTAssertTrue(app.staticTexts["Where it started"].exists)
        XCTAssertTrue(app.staticTexts["Where it is now"].exists)
        let threadScreenshot = XCTAttachment(screenshot: app.screenshot())
        threadScreenshot.name = "Living Thread with a real turning point"
        threadScreenshot.lifetime = .keepAlways
        add(threadScreenshot)
        let explore = app.buttons["Explore in Ask"]
        scrollUntilHittable(explore, in: app)
        XCTAssertTrue(explore.isHittable)
        let turningPointScreenshot = XCTAttachment(screenshot: app.screenshot())
        turningPointScreenshot.name = "Turning point and the question now"
        turningPointScreenshot.lifetime = .keepAlways
        add(turningPointScreenshot)
        explore.tap()

        XCTAssertTrue(app.navigationBars["Ask"].waitForExistence(timeout: timeout))
        let askField = app.textFields["Ask your library"]
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        XCTAssertEqual(askField.value as? String, "What would help me know what I think about identity, without forcing an answer too early?")
    }

    func testPersonalCompassConnectsChosenIdeasAndRealLifeExperiments() {
        let app = makeApp(initialRoute: "evolution")
        app.launch()

        XCTAssertTrue(app.navigationBars["Patterns"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.descendants(matching: .any)["remember.personal-compass"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["What you’re carrying now"].exists)
        XCTAssertTrue(app.staticTexts["Treat attention as evidence of what you value."].exists)
        XCTAssertTrue(app.staticTexts["Remove one recurring input that does not deserve a place in your week"].exists)

        let keep = app.buttons["Keep"]
        scrollUntilHittable(keep, in: app)
        XCTAssertTrue(keep.isHittable)
        keep.tap()

        let releases = app.buttons.matching(identifier: "Release")
        XCTAssertEqual(releases.count, 2)
    }

    func testFinishedExperimentBecomesPersonalCompassEvidence() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        let start = app.buttons["Do this now"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        start.tap()

        let finish = app.buttons["Finish experiment"]
        XCTAssertTrue(finish.waitForExistence(timeout: timeout))
        finish.tap()

        XCTAssertTrue(app.navigationBars["Experiment result"].waitForExistence(timeout: timeout))
        app.descendants(matching: .any)["remember.practice-result.helped"].tap()
        let note = app.descendants(matching: .any)["remember.practice-result.note"]
        XCTAssertTrue(note.waitForExistence(timeout: timeout))
        note.tap()
        note.typeText("Removing it made the day feel quieter.")
        app.buttons["remember.practice-result.save"].tap()
        XCTAssertTrue(app.navigationBars["Experiment result"].waitForNonExistence(timeout: timeout))

        selectPrimaryTab("Library", in: app)
        selectSection("Patterns", screenTitle: "Patterns", in: app)
        let guidance = app.descendants(matching: .any)["remember.compass-guidance.keep"]
        scrollUntilHittable(guidance, in: app)
        XCTAssertTrue(guidance.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["This helped. Keep it available as a principle, not just a saved thought."].exists)
        XCTAssertTrue(app.staticTexts["Removing it made the day feel quieter."].exists)
    }

    func testTodayReturnsAUsefulSaveForTheCurrentTask() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        app.buttons["Add task with details"].tap()
        let composerBar = app.navigationBars["Add task"]
        XCTAssertTrue(composerBar.waitForExistence(timeout: timeout))
        let titleField = app.textFields["Task name"]
        titleField.tap()
        titleField.typeText("Protect a focused block for creative work")
        app.buttons["remember.task.submit"].tap()
        XCTAssertTrue(composerBar.waitForNonExistence(timeout: timeout))

        selectPrimaryTab("Today", in: app)
        app.buttons["remember.today.savedIdeas"].tap()
        let contextualReturn = app.descendants(matching: .any)["remember.today.contextual-return"]
        scrollGentlyUntilHittable(contextualReturn, in: app)
        XCTAssertTrue(contextualReturn.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["For your current task"].exists)
        let returnedEssence = app.staticTexts.containing(
            NSPredicate(format: "label CONTAINS %@", "Protecting the first quiet hour")
        ).firstMatch
        XCTAssertTrue(returnedEssence.exists)

        let tryToday = app.buttons["remember.today.contextual-return.try"]
        scrollGentlyUntilHittable(tryToday, in: app)
        XCTAssertTrue(tryToday.isHittable)
        tryToday.tap()
        XCTAssertTrue(app.buttons["Added to Plan"].waitForExistence(timeout: timeout))

        let checkIn = app.buttons["remember.memory-check-in.still_true"]
        scrollGentlyUntilHittable(checkIn, in: app)
        XCTAssertTrue(checkIn.isHittable)

        let explore = app.buttons["Ask about this"]
        for _ in 0..<8 where !explore.isHittable { app.swipeDown() }
        scrollGentlyUntilHittable(explore, in: app)
        XCTAssertTrue(explore.isHittable)
        explore.tap()

        XCTAssertTrue(app.navigationBars["Ask"].waitForExistence(timeout: timeout))
        let askField = app.textFields["Ask your library"]
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        XCTAssertEqual(askField.value as? String, "What from “The first quiet hour is where I can hear myself think” could help me with “Protect a focused block for creative work” today?")
    }

    func testTodayReturnsAnIdeaKeptForFocus() {
        let app = makeApp(initialRoute: "today")
        app.launch()

        app.buttons["remember.today.savedIdeas"].tap()
        let focus = app.buttons["remember.today.need.focus"]
        XCTAssertTrue(focus.waitForExistence(timeout: timeout))
        focus.tap()

        let returnedIdea = app.descendants(matching: .any)["remember.today.intentional-return"]
        XCTAssertTrue(returnedIdea.waitForExistence(timeout: timeout))
        let openSavedItem = app.buttons["Open saved item"]
        scrollGentlyUntilHittable(openSavedItem, in: app)
        XCTAssertTrue(openSavedItem.isHittable)
        XCTAssertTrue(app.staticTexts["Before focused work"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label == %@", "Protecting the first quiet hour may be less about productivity and more about choosing whether the day begins from intention or reaction.")).firstMatch.exists)

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Today - intentional focus return"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testWeeklySynthesisRepeatsWhatWorkedIntoPlan() {
        let app = makeApp(initialRoute: "today")
        app.launch()

        app.buttons["remember.today.savedIdeas"].tap()
        let weeklySynthesis = app.descendants(matching: .any)["remember.today.weekly-synthesis"]
        scrollUntilHittable(weeklySynthesis, in: app)
        XCTAssertTrue(weeklySynthesis.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Something worked."].exists)
        XCTAssertTrue(app.staticTexts["Writing it down made the next step feel obvious."].exists)

        let repeatWhatWorked = app.buttons["Repeat what worked"]
        scrollUntilHittable(repeatWhatWorked, in: app)
        XCTAssertTrue(repeatWhatWorked.isHittable)
        repeatWhatWorked.tap()

        XCTAssertTrue(app.navigationBars["Plan"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Name one thing this season clarified"].waitForExistence(timeout: timeout))
    }

    func testLibraryFiltersAreAvailableWithoutCrowdingTheList() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: timeout))
        XCTAssertFalse(app.buttons["Filter and sort"].exists)
        app.buttons["remember.library.filter"].tap()
        XCTAssertTrue(app.buttons["All"].isHittable)
        XCTAssertTrue(app.buttons["Analyzed"].exists)
        XCTAssertTrue(app.buttons["Analyzing"].exists)
        XCTAssertTrue(app.buttons["Some details"].exists)
        XCTAssertTrue(app.buttons["Couldn’t analyze"].exists)

        let orderButton = app.buttons["Newest first"]
        XCTAssertTrue(orderButton.isHittable)
        orderButton.tap()
        XCTAssertTrue(app.buttons["Oldest first"].waitForExistence(timeout: timeout))
    }

    func testTaskDetailsStayOptionalAndCurrencySearchRemainsAvailable() {
        let taskApp = makeApp(initialRoute: "tasks")
        taskApp.launch()

        taskApp.buttons["Add task with details"].tap()
        XCTAssertTrue(taskApp.navigationBars["Add task"].waitForExistence(timeout: timeout))
        XCTAssertFalse(taskApp.buttons["5 minutes"].exists)
        taskApp.buttons["Add details"].tap()
        for label in ["Health", "Work", "Relationships", "5 minutes", "15 minutes"] {
            XCTAssertTrue(taskApp.buttons[label].exists, "Expected a direct choice for \(label).")
        }
        XCTAssertTrue(taskApp.descendants(matching: .any)["remember.task.priority"].exists)
        taskApp.navigationBars["Add task"].buttons["Close"].tap()
        taskApp.terminate()

        let moneyApp = makeApp(initialRoute: "money")
        moneyApp.launch()
        moneyApp.buttons["Add an account"].tap()
        XCTAssertTrue(moneyApp.navigationBars["Add account"].waitForExistence(timeout: timeout))

        let currencyButton = moneyApp.buttons["remember.currency.selection"]
        XCTAssertTrue(currencyButton.waitForExistence(timeout: timeout))
        XCTAssertTrue(currencyButton.isHittable)
        currencyButton.tap()

        XCTAssertTrue(moneyApp.navigationBars["Currency"].waitForExistence(timeout: timeout))
        let search = moneyApp.searchFields["Search currency"]
        XCTAssertTrue(search.waitForExistence(timeout: timeout))
        search.tap()
        search.typeText("yen")
        XCTAssertTrue(moneyApp.staticTexts["JPY"].waitForExistence(timeout: timeout))
    }

    private func assertLegacyRoute(_ route: LegacyRoute) {
        let app = makeApp(initialRoute: route.name)
        app.launch()
        defer { app.terminate() }

        let tabBar = shellTabBar(in: app)
        XCTAssertTrue(
            waitForSelection(tabBar.buttons[route.primaryTab]),
            "Legacy route \(route.name) should select \(route.primaryTab)."
        )
        XCTAssertTrue(
            app.navigationBars[route.screenTitle].waitForExistence(timeout: timeout),
            "Legacy route \(route.name) should show \(route.screenTitle)."
        )

        let sectionButton = app.buttons[route.section]
        XCTAssertTrue(sectionButton.exists, "Legacy route \(route.name) should expose the \(route.section) section.")
        XCTAssertTrue(waitForSelection(sectionButton), "Legacy route \(route.name) should select \(route.section).")
    }

    private func shellTabBar(in app: XCUIApplication) -> XCUIElement {
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: timeout))
        return tabBar
    }

    private func selectPrimaryTab(_ title: String, in app: XCUIApplication) {
        let button = shellTabBar(in: app).buttons[title]
        XCTAssertTrue(button.exists)
        button.tap()
        XCTAssertTrue(waitForSelection(button))
    }

    private func assertSectionPicker(
        _ identifier: String,
        labels: [String],
        selected: String,
        in app: XCUIApplication
    ) {
        let picker = app.descendants(matching: .any)[identifier]
        XCTAssertTrue(picker.waitForExistence(timeout: timeout))
        XCTAssertEqual(picker.buttons.allElementsBoundByIndex.map(\.label), labels)
        XCTAssertTrue(waitForSelection(picker.buttons[selected]))
    }

    private func selectSection(_ title: String, screenTitle: String, in app: XCUIApplication) {
        let button = app.buttons[title]
        XCTAssertTrue(button.waitForExistence(timeout: timeout))
        button.tap()
        XCTAssertTrue(waitForSelection(button))
        XCTAssertTrue(app.navigationBars[screenTitle].waitForExistence(timeout: timeout))
    }

    private func waitForSelection(_ element: XCUIElement) -> Bool {
        wait(for: NSPredicate(format: "selected == true"), on: element)
    }

    private func waitForEnabled(_ element: XCUIElement) -> Bool {
        wait(for: NSPredicate(format: "enabled == true"), on: element)
    }

    private func scrollUntilHittable(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<8 where !element.isHittable {
            app.swipeUp()
        }
    }

    private func scrollGentlyUntilHittable(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<16 where !element.isHittable {
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50))
            start.press(forDuration: 0.01, thenDragTo: end)
        }
    }

    private func wait(for predicate: NSPredicate, on element: XCUIElement) -> Bool {
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func makeApp(initialRoute: String = "today", mockFallback: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["REMEMBER_API_URL"] = "http://127.0.0.1:1"
        app.launchEnvironment["REMEMBER_MOCK_FALLBACK"] = mockFallback ? "1" : "0"
        app.launchEnvironment["REMEMBER_INITIAL_TAB"] = initialRoute
        app.launchArguments += [
            "-ApplePersistenceIgnoreState", "YES",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US"
        ]
        return app
    }

    private func attachScreenshot(of app: XCUIApplication, named name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}

private struct LegacyRoute {
    let name: String
    let primaryTab: String
    let section: String
    let screenTitle: String
}
