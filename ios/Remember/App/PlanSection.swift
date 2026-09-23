import Foundation

enum PlanSection: String, CaseIterable, Identifiable {
    case tasks = "Tasks"
    case calendar = "Calendar"
    case goals = "Goals"

    var id: Self { self }
}
