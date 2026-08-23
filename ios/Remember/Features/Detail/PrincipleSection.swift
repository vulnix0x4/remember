import SwiftUI

struct PrincipleSection: View {
    let principles: [String]
    let experiments: [String]
    @State private var carriedForward = false

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Optional", title: "Carry something forward")
            if let principle = principles.first {
                Label(principle, systemImage: "compass.drawing")
                    .font(.headline)
            }
            if let experiment = experiments.first {
                Text(experiment)
                    .font(.body)
                    .foregroundStyle(RememberDesign.secondaryText)
            }
            Button(carriedForward ? "Added to your active principles" : "Carry this forward", systemImage: carriedForward ? "checkmark" : "arrow.forward") {
                carriedForward.toggle()
            }
            .buttonStyle(.bordered)
            .sensoryFeedback(.success, trigger: carriedForward)
        }
        .padding(RememberDesign.spacing)
        .background(RememberDesign.accent.opacity(0.1), in: .rect(cornerRadius: RememberDesign.cornerRadius))
    }
}
