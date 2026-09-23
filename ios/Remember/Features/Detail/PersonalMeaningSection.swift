import SwiftUI

struct PersonalMeaningSection: View {
    let hypotheses: [String]
    let uncertainties: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "", title: "Possible relevance")
            ForEach(hypotheses, id: \.self) { possibility in
                Text(possibility).font(.body)
            }
            Label("A possibility, not a fact about you.", systemImage: "info.circle")
                .font(.footnote)
                .foregroundStyle(RememberDesign.secondaryText)
            ForEach(uncertainties, id: \.self) { uncertainty in
                DisclosureGroup("What is uncertain") {
                    Text(uncertainty).font(.subheadline).foregroundStyle(RememberDesign.secondaryText)
                }
            }
        }
    }
}
