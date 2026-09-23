import SwiftUI

struct LifeContainerView: View {
    @Binding var selection: LifeSection

    var body: some View {
        content
            .background(RememberDesign.canvas)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .health: LifeHealthView(lifeSection: $selection)
        case .money: LifeMoneyView(lifeSection: $selection)
        case .files: LifeFilesView(lifeSection: $selection)
        }
    }
}
