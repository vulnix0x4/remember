import SwiftUI

struct ImprintIdeasSection: View {
    let ideas: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            SectionHeading(title: "Key ideas")
            VStack(alignment: .leading, spacing: RememberDesign.spacingCompact) {
                ForEach(ideas, id: \.self) { idea in
                    Label {
                        Text(idea).font(.body)
                    } icon: {
                        Image(systemName: "circle.fill")
                            .font(.body.scaled(by: 0.35))
                            .foregroundStyle(RememberDesign.text3)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .rememberCard(padding: RememberDesign.spacing + 4)
        }
    }
}
