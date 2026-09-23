import SwiftUI

struct PlanContainerView: View {
    @Binding var selection: PlanSection

    var body: some View {
        content
            .background(RememberDesign.canvas)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .tasks: LifeTasksView(planSection: $selection)
        case .calendar: LifeCalendarView(planSection: $selection)
        case .goals: LifeGoalsView(planSection: $selection)
        }
    }
}
