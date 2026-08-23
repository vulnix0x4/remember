import SwiftUI

struct SectionHeader: View {
    let eyebrow: String
    let title: String

    var body: some View {
        Text(title)
            .font(.title2)
            .bold()
    }
}
