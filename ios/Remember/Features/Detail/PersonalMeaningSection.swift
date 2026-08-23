import SwiftUI

struct PersonalMeaningSection: View {
    let hypotheses: [String]
    let uncertainties: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "Interpretation", title: "Why this may have mattered")
            ForEach(hypotheses, id: \.self) { hypothesis in
                Text(hypothesis).font(.body)
            }
            Label("These are hypotheses, not facts about you.", systemImage: "info.circle")
                .font(.footnote)
                .foregroundStyle(RememberDesign.secondaryText)
            ForEach(uncertainties, id: \.self) { uncertainty in
                DisclosureGroup("What Remember is uncertain about") {
                    Text(uncertainty).font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                }
            }
        }
    }
}
