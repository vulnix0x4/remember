import SwiftUI

struct PersonalMeaningSection: View {
    let hypotheses: [String]
    let uncertainties: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Why it might matter")
            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                ForEach(hypotheses, id: \.self) { possibility in
                    Text(possibility).font(.body)
                }
                Text("A guess, not a fact about you.")
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text3)
                ForEach(uncertainties, id: \.self) { uncertainty in
                    Text(uncertainty)
                        .font(.subheadline)
                        .foregroundStyle(RememberDesign.text2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing + 4)
        }
    }
}
