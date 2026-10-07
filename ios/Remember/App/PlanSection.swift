import Foundation

enum PlanSection: String, CaseIterable, Identifiable {
    case tasks = "Tasks"
    case calendar = "Calendar"
    case goals = "Projects"

    var id: Self { self }
}
