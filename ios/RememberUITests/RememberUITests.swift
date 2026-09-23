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
    private let practiceTaskID = "60000000-0000-0000-0000-000000000001"
    private let firstNowTask = "Reply to Sam about Saturday"

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: - Shell

    func testTodayShowsOneNowCardAndPlanNavigation() {
        let app = makeApp()
        app.launch()

        let start = app.buttons["remember.now.start"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        XCTAssertTrue(start.isHittable)
        XCTAssertEqual(app.buttons.matching(identifier: "remember.now.start").count, 1, "Today shows exactly one Start.")
        XCTAssertTrue(app.staticTexts[firstNowTask].exists)
        attachScreenshot(of: app, named: "Focused Today")

        selectPrimaryTab("Plan", in: app)
        XCTAssertTrue(app.staticTexts["Plan"].waitForExistence(timeout: timeout))
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
        selectSection("Calendar", in: app)
        selectSection("Goals", in: app)
        XCTAssertTrue(element("remember.goal.quickAdd", in: app).waitForExistence(timeout: timeout))

        selectPrimaryTab("Library", in: app)
        assertSectionPicker("remember.section.library", labels: ["Saved", "Patterns"], selected: "Saved", in: app)
        selectSection("Patterns", in: app)
        XCTAssertTrue(app.staticTexts["What you’re carrying now"].waitForExistence(timeout: timeout))

        selectPrimaryTab("Life", in: app)
        assertSectionPicker("remember.section.life", labels: ["Health", "Money", "Files"], selected: "Health", in: app)
        selectSection("Money", in: app)
        selectSection("Files", in: app)
    }

    func testSettingsOpensFromTheAvatarAndDismisses() {
        let app = makeApp()
        app.launch()

        selectPrimaryTab("Life", in: app)
        let profileButton = app.buttons["remember.global.settings"]
        XCTAssertTrue(profileButton.waitForExistence(timeout: timeout))
        XCTAssertTrue(profileButton.isHittable)
        profileButton.tap()

        XCTAssertTrue(app.staticTexts["Settings"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.buttons["Export data"].exists)
        let doneButton = app.buttons["Done"]
        XCTAssertTrue(doneButton.isHittable)
        doneButton.tap()
        XCTAssertTrue(app.buttons["Export data"].waitForNonExistence(timeout: timeout))
        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Life"]))
    }

    func testLegacyLaunchRouteAliasesOpenTheirCompatibleDestination() {
        let routes = [
            LegacyRoute(name: "tasks", primaryTab: "Plan", section: "Tasks"),
            LegacyRoute(name: "calendar", primaryTab: "Plan", section: "Calendar"),
            LegacyRoute(name: "goals", primaryTab: "Plan", section: "Goals"),
            LegacyRoute(name: "health", primaryTab: "Life", section: "Health"),
            LegacyRoute(name: "money", primaryTab: "Life", section: "Money"),
            LegacyRoute(name: "files", primaryTab: "Life", section: "Files"),
            LegacyRoute(name: "evolution", primaryTab: "Library", section: "Patterns")
        ]

        for route in routes {
            assertLegacyRoute(route)
        }

        let settingsApp = makeApp(initialRoute: "settings")
        settingsApp.launch()
        XCTAssertTrue(settingsApp.staticTexts["Settings"].waitForExistence(timeout: timeout))
        settingsApp.buttons["Done"].tap()
        XCTAssertTrue(settingsApp.buttons["Export data"].waitForNonExistence(timeout: timeout))
        XCTAssertTrue(waitForSelection(shellTabBar(in: settingsApp).buttons["Today"]))
        settingsApp.terminate()
    }

    func testSignedOutOwnerSeesPrivateArchiveLogin() {
        let app = makeApp(mockFallback: false)
        app.launch()

        XCTAssertTrue(app.staticTexts["Welcome back"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.buttons["Sign in"].exists)
    }

    // MARK: - Tasks

    func testQuickAddFromTheBottomBarCreatesTasksWithoutAForm() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        let quickAdd = element("remember.task.quickAdd", in: app)
        XCTAssertTrue(quickAdd.waitForExistence(timeout: timeout))
        quickAdd.tap()
        quickAdd.typeText("Send the short update\n")
        XCTAssertTrue(app.staticTexts["Send the short update"].waitForExistence(timeout: timeout))

        // Focus stays in the bar, so several tasks can be dumped in a row.
        quickAdd.typeText("Water the plants tomorrow 20m\n")
        let row = app.buttons.matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "remember.life-task.", "Water the plants"
        )).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: timeout), "A quick-added task appears as a Plan row.")
        XCTAssertTrue(row.label.contains("20 min"), "Duration is parsed from the words.")
        XCTAssertFalse(app.staticTexts["Add task"].exists, "Quick add never opens a form.")
    }

    func testStartShowsDoingThenDoneOffersUndo() {
        let app = makeApp()
        app.launch()

        let start = app.buttons["remember.now.start"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        start.tap()

        let done = app.buttons["remember.now.done"]
        XCTAssertTrue(done.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["DOING"].exists || app.otherElements["DOING"].exists || app.descendants(matching: .any)["DOING"].exists)
        XCTAssertTrue(app.buttons["remember.now.stuck"].exists)
        attachScreenshot(of: app, named: "Doing")

        done.tap()
        let undo = visibleUndo(in: app)
        XCTAssertTrue(undo.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Done. Nice work."].firstMatch.exists)

        undo.tap()
        XCTAssertTrue(anyElement(containing: firstNowTask, in: app).waitForExistence(timeout: timeout), "Undo brings the finished task back.")
    }

    func testStuckSheetOffersFourChoicesAndDeleteCanBeUndone() {
        let app = makeApp()
        app.launch()

        app.buttons["remember.now.start"].tap()
        let stuck = app.buttons["remember.now.stuck"]
        XCTAssertTrue(stuck.waitForExistence(timeout: timeout))
        stuck.tap()

        XCTAssertTrue(app.staticTexts["What’s getting in the way?"].waitForExistence(timeout: timeout))
        for option in ["It’s too big", "Not sure where to start", "Only have 5 minutes", "Do something else"] {
            XCTAssertTrue(button(startingWith: option, in: app).exists, "Stuck sheet should offer \(option).")
        }
        XCTAssertFalse(app.buttons["Choose another task"].exists)
        attachScreenshot(of: app, named: "Stuck sheet")

        app.buttons["remember.stuck.delete"].tap()
        XCTAssertTrue(app.staticTexts["What’s getting in the way?"].waitForNonExistence(timeout: timeout))
        let undo = visibleUndo(in: app)
        XCTAssertTrue(undo.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Deleted"].firstMatch.exists)
        XCTAssertTrue(anyElement(containing: firstNowTask, in: app).waitForNonExistence(timeout: timeout))

        undo.tap()
        if !anyElement(containing: firstNowTask, in: app).waitForExistence(timeout: timeout) { print("DEBUGDUMP-DELETE\n" + app.debugDescription) }
        XCTAssertTrue(anyElement(containing: firstNowTask, in: app).exists, "Undo restores the deleted task.")
    }

    func testDoingSomethingElseKeepsThePreviousTaskInPlan() {
        let app = makeApp(initialRoute: "tasks")
        // Runs on Plan on purpose: the Now card's sheets must open there too.
        app.launch()

        let start = app.buttons["remember.now.start"]
        XCTAssertTrue(start.waitForExistence(timeout: timeout))
        start.tap()
        let stuck = app.buttons["remember.now.stuck"]
        XCTAssertTrue(stuck.waitForExistence(timeout: timeout))
        stuck.tap()

        let somethingElse = button(startingWith: "Do something else", in: app)
        XCTAssertTrue(somethingElse.waitForExistence(timeout: timeout))
        somethingElse.tap()

        XCTAssertTrue(visibleUndo(in: app).waitForExistence(timeout: timeout))
        XCTAssertTrue(app.buttons["remember.now.start"].waitForExistence(timeout: timeout), "Jev offers the next task.")
        let previous = app.buttons.matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "remember.life-task.", firstNowTask
        )).firstMatch
        scrollUntilHittable(previous, in: app)
        XCTAssertTrue(previous.exists, "The set-aside task should still be in Plan.")
    }

    func testTaskSheetKeepsDetailsOptionalAndCurrencySearchRemainsAvailable() {
        let taskApp = makeApp(initialRoute: "tasks")
        taskApp.launch()

        let row = taskApp.buttons["remember.life-task.\(practiceTaskID)"]
        scrollUntilHittable(row, in: taskApp)
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        row.tap()

        XCTAssertTrue(taskApp.buttons["Start now"].waitForExistence(timeout: timeout))
        for label in ["5 min", "30 min", "Tomorrow", "This weekend", "Weekly"] {
            XCTAssertTrue(taskApp.buttons[label].exists, "Expected a direct choice for \(label).")
        }
        XCTAssertTrue(taskApp.switches.firstMatch.exists, "Important is a toggle.")
        taskApp.buttons["Done"].tap()
        XCTAssertTrue(taskApp.buttons["Start now"].waitForNonExistence(timeout: timeout))
        taskApp.terminate()

        let moneyApp = makeApp(initialRoute: "money")
        moneyApp.launch()
        let addAccount = moneyApp.buttons["Add an account"]
        XCTAssertTrue(addAccount.waitForExistence(timeout: timeout))
        addAccount.tap()
        XCTAssertTrue(moneyApp.staticTexts["Add account"].waitForExistence(timeout: timeout))

        let currencyButton = moneyApp.buttons["remember.currency.selection"]
        XCTAssertTrue(currencyButton.waitForExistence(timeout: timeout))
        // The row starts behind the pinned "Add account" button; bring it up first.
        moneyApp.staticTexts["Add account"].swipeUp()
        XCTAssertTrue(currencyButton.isHittable)
        currencyButton.tap()

        if !moneyApp.navigationBars["Currency"].waitForExistence(timeout: timeout) { print("DEBUGDUMP-CURRENCY\n" + moneyApp.debugDescription) }
        XCTAssertTrue(moneyApp.navigationBars["Currency"].exists)
        let search = moneyApp.searchFields["Search currency"]
        XCTAssertTrue(search.waitForExistence(timeout: timeout))
        search.tap()
        search.typeText("yen")
        XCTAssertTrue(moneyApp.staticTexts["JPY"].waitForExistence(timeout: timeout))
    }

    func testFinishedExperimentBecomesPersonalCompassEvidence() {
        let app = makeApp(initialRoute: "tasks")
        app.launch()

        let row = app.buttons["remember.life-task.\(practiceTaskID)"]
        scrollUntilHittable(row, in: app)
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        row.tap()
        let startNow = app.buttons["Start now"]
        XCTAssertTrue(startNow.waitForExistence(timeout: timeout))
        startNow.tap()

        let done = app.buttons["remember.now.done"]
        for _ in 0..<4 where !done.isHittable { app.swipeDown() }
        XCTAssertTrue(done.waitForExistence(timeout: timeout))
        done.tap()

        XCTAssertTrue(app.staticTexts["Did it help?"].waitForExistence(timeout: timeout))
        app.descendants(matching: .any)["remember.practice-result.helped"].tap()
        let note = app.descendants(matching: .any)["remember.practice-result.note"]
        XCTAssertTrue(note.waitForExistence(timeout: timeout))
        note.tap()
        note.typeText("Removing it made the day feel quieter.")
        app.buttons["remember.practice-result.save"].tap()
        XCTAssertTrue(app.staticTexts["Did it help?"].waitForNonExistence(timeout: timeout))

        selectPrimaryTab("Library", in: app)
        selectSection("Patterns", in: app)
        let guidance = app.descendants(matching: .any)["remember.compass-guidance.keep"]
        scrollUntilHittable(guidance, in: app)
        XCTAssertTrue(guidance.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["This helped. Keep it as a principle."].exists)
        XCTAssertTrue(app.staticTexts["Removing it made the day feel quieter."].exists)
    }

    // MARK: - Today ideas

    func testReturnedIdeaSitsUnderOneIdeaForTodayAndLearnsWhatStillBelongs() {
        let app = makeApp()
        app.launch()

        addCurrentTask("Protect a focused block for creative work", in: app)
        XCTAssertFalse(app.buttons["remember.today.savedIdeas"].exists, "No disclosure hides the returned idea.")
        let heading = app.staticTexts["ONE IDEA FOR TODAY"]
        scrollGentlyUntilHittable(heading, in: app)
        XCTAssertTrue(heading.exists)

        let changed = app.buttons["remember.memory-check-in.changed_mind"]
        scrollGentlyUntilHittable(changed, in: app)
        XCTAssertTrue(changed.isHittable)
        XCTAssertTrue(app.buttons["remember.memory-check-in.still_true"].exists)
        XCTAssertTrue(app.buttons["remember.memory-check-in.not_sure"].exists)
        XCTAssertTrue(app.buttons["remember.memory-check-in.no_longer_relevant"].exists)
        attachScreenshot(of: app, named: "Memory check-in choices")

        changed.tap()
        if !app.staticTexts["Your change of mind is part of the story."].waitForExistence(timeout: timeout) { print("DEBUGDUMP-CHANGED\n" + app.debugDescription) }
        XCTAssertTrue(app.staticTexts["Your change of mind is part of the story."].exists)
        attachScreenshot(of: app, named: "Memory check-in learned")

        let compass = app.buttons["remember.memory-check-in.compass"]
        scrollGentlyUntilHittable(compass, in: app)
        compass.tap()
        XCTAssertTrue(app.staticTexts["What you’re carrying now"].waitForExistence(timeout: timeout))
    }

    func testReleasedReturnKeepsItsAcknowledgementUntilTheUserIsDone() {
        let app = makeApp()
        app.launch()

        addCurrentTask("Protect a focused block for creative work", in: app)
        let release = app.buttons["remember.memory-check-in.no_longer_relevant"]
        scrollGentlyUntilHittable(release, in: app)
        XCTAssertTrue(release.isHittable)
        release.tap()

        let acknowledgement = app.staticTexts["Released from your current guidance."]
        XCTAssertTrue(acknowledgement.waitForExistence(timeout: timeout))
        attachScreenshot(of: app, named: "Released return acknowledgement")

        let done = app.buttons["remember.today.return.done"]
        scrollGentlyUntilHittable(done, in: app)
        done.tap()
        XCTAssertTrue(acknowledgement.waitForNonExistence(timeout: timeout))
    }

    func testTodayReturnsAUsefulSaveForTheCurrentTask() {
        let app = makeApp()
        app.launch()

        addCurrentTask("Protect a focused block for creative work", in: app)

        let contextualReturn = app.descendants(matching: .any)["remember.today.contextual-return"]
        scrollGentlyUntilHittable(contextualReturn, in: app)
        XCTAssertTrue(contextualReturn.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["For your current task"].exists)

        let tryToday = app.buttons["remember.today.contextual-return.try"]
        scrollGentlyUntilHittable(tryToday, in: app)
        XCTAssertTrue(tryToday.isHittable)
        tryToday.tap()
        XCTAssertTrue(app.buttons["Added to Plan"].waitForExistence(timeout: timeout))

        let explore = app.buttons["Ask about this"]
        scrollGentlyUntilHittable(explore, in: app)
        XCTAssertTrue(explore.isHittable)
        explore.tap()

        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Ask"]))
        let askField = field(labeled: "Ask your library", in: app)
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        let handoff = askField.value as? String ?? ""
        XCTAssertTrue(handoff.hasPrefix("What from “"), "Ask receives the returned save as the question: \(handoff)")
        XCTAssertTrue(handoff.hasSuffix("could help me with “Protect a focused block for creative work” today?"))
    }

    // MARK: - Library

    func testSavingAThoughtFromTheLibraryAddBar() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        let quickSave = element("remember.library.quickSave", in: app)
        XCTAssertTrue(quickSave.waitForExistence(timeout: timeout))
        quickSave.tap()
        let thought = "A slower start helps me choose the day instead of inherit it"
        quickSave.typeText(thought + "\n")

        XCTAssertTrue(app.staticTexts["Thought saved"].firstMatch.waitForExistence(timeout: timeout))
        let savedThought = app.staticTexts[thought]
        XCTAssertTrue(savedThought.waitForExistence(timeout: timeout))
        attachScreenshot(of: app, named: "Quick Thought in Library")

        savedThought.tap()
        XCTAssertTrue(app.staticTexts["YOUR WORDS"].waitForExistence(timeout: timeout) || app.staticTexts["Your words"].exists)
        XCTAssertFalse(app.buttons["Open original"].exists)
        attachScreenshot(of: app, named: "Quick Thought detail")
    }

    func testDetailedCaptureValidatesLinksAndSavesThoughts() {
        let app = makeApp(initialRoute: "capture")
        app.launch()

        XCTAssertTrue(app.staticTexts["Save something"].waitForExistence(timeout: timeout))
        let linkField = app.textFields["Link to save"]
        XCTAssertTrue(linkField.waitForExistence(timeout: timeout))
        linkField.tap()
        linkField.typeText("not-a-link")
        app.buttons["Save link"].tap()
        XCTAssertTrue(app.staticTexts["Enter a complete https link."].waitForExistence(timeout: timeout))
        attachScreenshot(of: app, named: "Capture")

        app.buttons["Thought"].tap()
        let thought = "Quiet mornings make hard choices easier"
        let thoughtField = field(labeled: "Thought to remember", in: app)
        XCTAssertTrue(thoughtField.waitForExistence(timeout: timeout))
        thoughtField.tap()
        thoughtField.typeText(thought)
        let saveThought = app.buttons["Save thought"]
        XCTAssertTrue(waitForEnabled(saveThought))
        saveThought.tap()
        XCTAssertTrue(app.staticTexts["Saved"].waitForExistence(timeout: timeout))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["Saved"].waitForNonExistence(timeout: timeout))

        selectPrimaryTab("Library", in: app)
        XCTAssertTrue(app.staticTexts[thought].waitForExistence(timeout: timeout))
    }

    func testLibraryLastItemRemainsReachableAboveTheTabBar() {
        let app = makeApp(initialRoute: "library")
        app.launch()
        XCTAssertTrue(app.staticTexts["Library"].waitForExistence(timeout: timeout))

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

        let row = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "remember.library.imprint.")
        ).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: timeout))
        XCTAssertLessThan(row.frame.height, 180, "A default-size Library row should stay compact and adaptive.")
    }

    func testLibraryFiltersAreOneChipRow() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        let filters = app.descendants(matching: .any)["remember.library.filter"]
        XCTAssertTrue(filters.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.buttons["All"].isHittable)
        XCTAssertTrue(app.buttons["Analyzed"].exists)
        XCTAssertTrue(app.buttons["Analyzing"].exists)
        XCTAssertTrue(app.buttons["Some details"].exists)
        XCTAssertTrue(app.buttons["Couldn’t analyze"].exists)

        let orderButton = app.buttons["Sorted newest first"]
        XCTAssertTrue(orderButton.exists)
        filters.swipeLeft()
        orderButton.tap()
        XCTAssertTrue(app.buttons["Sorted oldest first"].waitForExistence(timeout: timeout))
    }

    func testSavedExperimentCarriesForwardIntoPlan() {
        let app = makeApp(initialRoute: "library")
        app.launch()

        let savedIdea = app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS %@", "Your worst years are not wasted years")
        ).firstMatch
        scrollUntilHittable(savedIdea, in: app)
        XCTAssertTrue(savedIdea.waitForExistence(timeout: timeout))
        savedIdea.tap()

        XCTAssertTrue(app.descendants(matching: .any)["remember.detail"].waitForExistence(timeout: timeout))
        let tryThis = app.buttons["Try this"]
        scrollUntilHittable(tryThis, in: app)
        XCTAssertTrue(tryThis.isHittable)
        attachScreenshot(of: app, named: "Library item detail")
        tryThis.tap()

        let addedToPlan = app.buttons["Added to Plan"]
        XCTAssertTrue(addedToPlan.waitForExistence(timeout: timeout))
        addedToPlan.tap()

        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Plan"]))
        XCTAssertTrue(app.staticTexts["Write one thing this season clarified, and one thing you are ready to release"].waitForExistence(timeout: timeout))
    }

    // MARK: - Patterns

    func testWeeklySynthesisSitsAtTopOfPatternsAndRepeatsWhatWorked() {
        let app = makeApp(initialRoute: "patterns")
        app.launch()

        let weeklySynthesis = app.descendants(matching: .any)["remember.today.weekly-synthesis"]
        XCTAssertTrue(weeklySynthesis.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Something worked."].exists)
        XCTAssertTrue(app.staticTexts["Writing it down made the next step feel obvious."].exists)
        attachScreenshot(of: app, named: "Patterns")

        let repeatWhatWorked = app.buttons["Repeat what worked"]
        scrollUntilHittable(repeatWhatWorked, in: app)
        XCTAssertTrue(repeatWhatWorked.isHittable)
        repeatWhatWorked.tap()

        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Plan"]))
        XCTAssertTrue(app.staticTexts["Name one thing this season clarified"].waitForExistence(timeout: timeout))
    }

    func testLivingThreadShowsChangeAndHandsTheQuestionToAsk() {
        let app = makeApp(initialRoute: "evolution")
        app.launch()

        let threads = app.buttons["Threads"]
        XCTAssertTrue(threads.waitForExistence(timeout: timeout))
        scrollUntilHittable(threads, in: app)
        threads.tap()
        XCTAssertTrue(app.staticTexts["IDEAS THAT KEEP FINDING YOU"].waitForExistence(timeout: timeout))
        let identity = app.descendants(matching: .any)["remember.thread.identity"]
        scrollUntilHittable(identity, in: app)
        XCTAssertTrue(identity.waitForExistence(timeout: timeout))
        identity.tap()

        XCTAssertTrue(app.staticTexts["Identity"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["The question now"].exists)
        attachScreenshot(of: app, named: "Living Thread")
        let started = app.staticTexts["Where it started"]
        scrollUntilHittable(started, in: app)
        XCTAssertTrue(started.exists)
        XCTAssertTrue(app.staticTexts["Where it is now"].exists)

        let explore = app.buttons["Explore in Ask"]
        for _ in 0..<8 where !explore.isHittable { app.swipeDown() }
        XCTAssertTrue(explore.isHittable)
        explore.tap()

        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Ask"]))
        let askField = field(labeled: "Ask your library", in: app)
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        XCTAssertEqual(askField.value as? String, "What would help me know what I think about identity, without forcing an answer too early?")
    }

    func testPersonalCompassConnectsChosenIdeasAndRealLifeExperiments() {
        let app = makeApp(initialRoute: "evolution")
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["remember.personal-compass"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["What you’re carrying now"].exists)
        let truth = app.staticTexts["Treat attention as evidence of what you value."]
        scrollUntilHittable(truth, in: app)
        XCTAssertTrue(truth.exists)
        XCTAssertTrue(app.staticTexts["Remove one recurring input that does not deserve a place in your week"].exists)

        let keep = app.buttons["Keep"]
        scrollUntilHittable(keep, in: app)
        XCTAssertTrue(keep.isHittable)
        keep.tap()

        let releases = app.buttons.matching(identifier: "Release")
        XCTAssertTrue(wait(for: NSPredicate(format: "count == 2"), on: releases))
    }

    // MARK: - Ask

    func testAskKeepsGroundingQuietlyAvailable() {
        let app = makeApp(initialRoute: "ask")
        app.launch()

        app.buttons["What have I saved about focus?"].tap()
        XCTAssertTrue(app.staticTexts["From your saves"].waitForExistence(timeout: timeout))
        let supportingSaves = app.buttons["Supporting saves"]
        XCTAssertTrue(supportingSaves.waitForExistence(timeout: timeout))
        attachScreenshot(of: app, named: "Ask conversation")
        supportingSaves.tap()
        let firstSource = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "Your worst years are not wasted years")
        ).firstMatch
        XCTAssertTrue(firstSource.waitForExistence(timeout: timeout))
    }

    func testAskTurnsAGroundedAnswerIntoAPlanExperiment() {
        let app = makeApp(initialRoute: "ask")
        app.launch()

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
        XCTAssertTrue(waitForSelection(shellTabBar(in: app).buttons["Plan"]))
        XCTAssertTrue(app.staticTexts["Write one thing this season clarified, and one thing you are ready to release"].waitForExistence(timeout: timeout))
    }

    func testDecisionUsesSavedMemoryAndCreatesARealWorldTest() {
        let app = makeApp(initialRoute: "ask")
        app.launch()

        let decisionEntry = app.buttons["remember.ask.decision"]
        XCTAssertTrue(decisionEntry.waitForExistence(timeout: timeout))
        XCTAssertTrue(decisionEntry.isHittable)
        decisionEntry.tap()

        XCTAssertTrue(app.descendants(matching: .any)["remember.decision.title"].waitForExistence(timeout: timeout))
        let decisionField = element("remember.decision.input", in: app)
        XCTAssertTrue(decisionField.waitForExistence(timeout: timeout))
        decisionField.tap()
        decisionField.typeText("Should I protect more time for creative work?")

        let submit = app.buttons["remember.decision.submit"]
        XCTAssertTrue(waitForEnabled(submit))
        submit.tap()

        XCTAssertTrue(app.staticTexts["What seems to matter"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["What pulls you toward it"].exists)

        let tryThis = app.buttons["remember.decision.try"]
        scrollUntilHittable(tryThis, in: app)
        XCTAssertTrue(tryThis.isHittable)
        tryThis.tap()
        XCTAssertTrue(app.buttons["Added to Plan"].waitForExistence(timeout: timeout))

        selectPrimaryTab("Plan", in: app)
        XCTAssertTrue(app.staticTexts["Should I protect more time for creative work"].waitForExistence(timeout: timeout))
    }

    // MARK: - Accessibility

    func testLargestDynamicTypeKeepsGlobalActionsAndNavigationReachable() {
        let app = makeApp()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge"
        ]
        app.launch()

        let tabBar = shellTabBar(in: app)
        XCTAssertEqual(tabBar.buttons.count, 5)
        XCTAssertTrue(app.buttons["Profile and settings"].isHittable)
        let quickAdd = element("remember.task.quickAdd", in: app)
        XCTAssertTrue(quickAdd.waitForExistence(timeout: timeout))
        XCTAssertLessThan(quickAdd.frame.maxY, tabBar.frame.minY)

        let start = app.buttons["remember.now.start"]
        scrollUntilHittable(start, in: app)
        XCTAssertTrue(start.isHittable)

        selectPrimaryTab("Library", in: app)
        XCTAssertTrue(app.buttons["Saved"].waitForExistence(timeout: timeout))
        XCTAssertTrue(app.buttons["Patterns"].exists)

        let firstSave = app.staticTexts["A link waiting for another try"]
        scrollUntilHittable(firstSave, in: app)
        XCTAssertTrue(firstSave.isHittable)
        XCTAssertLessThan(firstSave.frame.maxY, tabBar.frame.minY)

        selectPrimaryTab("Ask", in: app)
        let askField = field(labeled: "Ask your library", in: app)
        XCTAssertTrue(askField.waitForExistence(timeout: timeout))
        XCTAssertTrue(askField.isHittable)
        let askButton = app.buttons["remember.ask.submit"]
        XCTAssertTrue(askButton.exists)
        XCTAssertLessThan(askButton.frame.maxY, tabBar.frame.minY)
    }

    // MARK: - Helpers

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
            app.staticTexts[route.primaryTab].waitForExistence(timeout: timeout),
            "Legacy route \(route.name) should show the \(route.primaryTab) header."
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

    private func selectSection(_ title: String, in app: XCUIApplication) {
        let button = app.buttons[title]
        XCTAssertTrue(button.waitForExistence(timeout: timeout))
        button.tap()
        XCTAssertTrue(waitForSelection(button))
    }

    /// Any element by identifier (vertical text fields surface as text views).
    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func field(labeled label: String, in app: XCUIApplication) -> XCUIElement {
        let textField = app.textFields[label]
        return textField.exists ? textField : app.textViews[label].exists ? app.textViews[label] : textField
    }

    /// Every tab keeps its own dock, so pick the toast Undo that is on screen.
    private func visibleUndo(in app: XCUIApplication) -> XCUIElement {
        let undos = app.buttons.matching(identifier: "remember.toast.undo")
        guard undos.firstMatch.waitForExistence(timeout: timeout) else { return undos.firstMatch }
        for index in 0..<undos.count {
            let candidate = undos.element(boundBy: index)
            if candidate.isHittable { return candidate }
        }
        return undos.firstMatch
    }

    /// Quick-adds a task on Today (it becomes the current task in preview data), then drops the keyboard.
    private func addCurrentTask(_ title: String, in app: XCUIApplication) {
        let quickAdd = element("remember.task.quickAdd", in: app)
        XCTAssertTrue(quickAdd.waitForExistence(timeout: timeout))
        quickAdd.tap()
        quickAdd.typeText(title + "\n")
        XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: timeout))
        // Scrolling the page drops the keyboard.
        for _ in 0..<3 where keyboardIsVisible(in: app) {
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
            start.press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)))
            _ = wait(for: NSPredicate(format: "exists == false"), on: app.otherElements["inputView"])
        }
        XCTAssertFalse(keyboardIsVisible(in: app), "Scrolling drops the keyboard.")
    }

    private func keyboardIsVisible(in app: XCUIApplication) -> Bool {
        app.keyboards.count > 0 || app.otherElements["inputView"].exists
    }

    private func anyElement(containing text: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func button(startingWith prefix: String, in app: XCUIApplication) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
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

    /// Scrolls in small steps until the element sits clear of the pinned add bar (and keyboard).
    private func scrollGentlyUntilHittable(_ element: XCUIElement, in app: XCUIApplication) {
        func isComfortable() -> Bool {
            guard element.exists, element.isHittable else { return false }
            let limit = app.frame.height * (keyboardIsVisible(in: app) ? 0.55 : 0.75)
            return element.frame.maxY < limit
        }
        for _ in 0..<16 where !isComfortable() {
            let keyboardUp = keyboardIsVisible(in: app)
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: keyboardUp ? 0.42 : 0.62))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: keyboardUp ? 0.22 : 0.40))
            start.press(forDuration: 0.01, thenDragTo: end)
        }
    }

    private func wait(for predicate: NSPredicate, on object: Any) -> Bool {
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: object)
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
}
