import SwiftUI

struct ImprintIdeasSection: View {
    let ideas: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            SectionHeader(eyebrow: "", title: "Key ideas")
            ForEach(ideas, id: \.self) { idea in
                Label {
                    Text(idea).font(.body)
                } icon: {
                    Image(systemName: "circle.fill")
                        .font(.body.scaled(by: 0.35))
                        .foregroundStyle(RememberDesign.accent)
                }
            }
        }
    }
}
