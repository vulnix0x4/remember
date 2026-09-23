import SwiftUI

struct ProcessingDetailState: View {
    var body: some View {
        ContentUnavailableView {
            Label("Getting this save ready", systemImage: "clock")
        } description: {
            Text("The link is safe. Key ideas, moments, and related saves will appear here when they’re ready.")
        }
    }
}
