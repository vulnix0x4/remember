import Foundation
import Testing
@testable import Remember

struct ReturnCueFinderTests {
    @Test func returnsTheSaveKeptForAStuckMoment() throws {
        let result = ReturnCueFinder.find(in: FixtureLibrary.imprints, cue: .stuck)
        #expect(result?.title == "Your worst years are not wasted years")
    }

    @Test func waitsUntilAChosenDayArrives() throws {
        var item = try #require(FixtureLibrary.imprints.first)
        item.returnCue = .date
        item.returnAt = Date(timeIntervalSince1970: 2_000)

        #expect(ReturnCueFinder.find(in: [item], cue: .date, now: Date(timeIntervalSince1970: 1_999)) == nil)
        #expect(ReturnCueFinder.find(in: [item], cue: .date, now: Date(timeIntervalSince1970: 2_000))?.id == item.id)
    }

    @Test func ignoresItemsThatAreStillProcessing() throws {
        var item = try #require(FixtureLibrary.imprints.first(where: { $0.state == .processing }))
        item.returnCue = .focus
        #expect(ReturnCueFinder.find(in: [item], cue: .focus) == nil)
    }

    @Test func honorsTheLatestCheckInForChosenMoments() throws {
        let item = try #require(FixtureLibrary.imprints.first)
        let released = reflection(for: item, response: .noLongerRelevant, at: 2_000)
        let reaffirmed = reflection(for: item, response: .stillTrue, at: 3_000)

        #expect(ReturnCueFinder.find(in: [item], cue: .stuck, reflections: [released]) == nil)
        #expect(ReturnCueFinder.find(in: [item], cue: .stuck, reflections: [released, reaffirmed])?.id == item.id)
    }

    @Test(arguments: MemoryReflection.allCases)
    func everyCheckInFulfillsTheChosenDate(response: MemoryReflection) throws {
        var item = try #require(FixtureLibrary.imprints.first)
        item.returnCue = .date
        item.returnAt = Date(timeIntervalSince1970: 2_000)
        let checkIn = reflection(for: item, response: response, at: 2_000)

        #expect(ReturnCueFinder.find(in: [item], cue: .date, reflections: [checkIn], now: Date(timeIntervalSince1970: 3_000)) == nil)
    }

    @Test func anEarlierCheckInDoesNotFulfillANewReturnDate() throws {
        var item = try #require(FixtureLibrary.imprints.first)
        item.returnCue = .date
        item.returnAt = Date(timeIntervalSince1970: 3_000)
        let checkIn = reflection(for: item, response: .changedMind, at: 2_000)

        #expect(ReturnCueFinder.find(in: [item], cue: .date, reflections: [checkIn], now: Date(timeIntervalSince1970: 2_999)) == nil)
        #expect(ReturnCueFinder.find(in: [item], cue: .date, reflections: [checkIn], now: Date(timeIntervalSince1970: 3_000))?.id == item.id)
    }

    @Test func pausesChosenReturnsAfterNotTodayAndResumesAfterSevenDays() throws {
        let item = try #require(FixtureLibrary.imprints.first)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let feedback = EvolutionReturnFeedback(
            id: UUID().uuidString, itemId: item.id.uuidString, response: "not_today", occurredAt: now.formatted(.iso8601)
        )

        #expect(ReturnCueFinder.find(in: [item], cue: .stuck, returnFeedback: [feedback], now: now) == nil)
        #expect(ReturnCueFinder.find(in: [item], cue: .stuck, returnFeedback: [feedback], now: now.addingTimeInterval(7 * 86_400 + 1))?.id == item.id)
    }

    private func reflection(for item: Imprint, response: MemoryReflection, at timestamp: TimeInterval) -> EvolutionReflection {
        EvolutionReflection(
            id: UUID().uuidString,
            itemId: item.id.uuidString,
            response: response.rawValue,
            occurredAt: Date(timeIntervalSince1970: timestamp).formatted(.iso8601)
        )
    }
}
