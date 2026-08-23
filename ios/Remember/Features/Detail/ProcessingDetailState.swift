import SwiftUI

struct ProcessingDetailState: View {
    var body: some View {
        ContentUnavailableView {
            Label("Understanding this source", systemImage: "sparkles")
        } description: {
            Text("The link is already safe. Ideas, moments, and connections will arrive here when processing finishes.")
        }
    }
}
