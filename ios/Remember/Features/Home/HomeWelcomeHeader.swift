import SwiftUI

struct HomeWelcomeHeader: View {
    let saveAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            ViewThatFits(in: .horizontal) {
                HStack {
                    date
                    Spacer()
                    SaveSomethingButton(action: saveAction)
                }
                VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                    date
                    SaveSomethingButton(action: saveAction)
                }
            }
            Text("Your memory")
                .font(.largeTitle)
                .bold()
                .tracking(-1.2)
            Text("Recent saves stay close. Older ideas return when there is something honest to revisit.")
                .font(.body)
                .foregroundStyle(RememberDesign.secondaryText)
        }
    }

    private var date: some View {
        Text(Date.now, format: .dateTime.weekday(.wide).month(.wide).day())
            .font(.subheadline)
            .bold()
            .foregroundStyle(RememberDesign.accent)
    }
}
