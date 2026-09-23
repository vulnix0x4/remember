import SwiftUI

struct LibraryContainerView: View {
    @Binding var selection: LibrarySection

    var body: some View {
        content
            .background(RememberDesign.canvas)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .saved: LibraryView(librarySection: $selection)
        case .patterns: EvolutionView(librarySection: $selection)
        }
    }
}
