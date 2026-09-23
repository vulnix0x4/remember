import SwiftUI

struct ArchiveArtwork: View {
    let imprint: Imprint
    var width: CGFloat?
    var height = 190.0

    init(imprint: Imprint, width: CGFloat? = nil, height: CGFloat = 190) {
        self.imprint = imprint
        self.width = width
        self.height = height
    }

    var body: some View {
        ZStack {
            RememberDesign.surfaceRaised
            if let previewURL = imprint.sourcePreviewURL {
                AsyncImage(url: previewURL, transaction: Transaction(animation: .easeOut(duration: 0.24))) { phase in
                    if case let .success(image) = phase {
                        image
                            .resizable()
                            .scaledToFill()
                            .transition(.opacity)
                    } else {
                        Color.clear
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                LinearGradient(
                    colors: [.clear, .black.opacity(0.38)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            Image(systemName: artworkSymbol)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.black.opacity(0.58), in: .circle)
        }
        .frame(width: width, height: height)
        .frame(maxWidth: width == nil ? .infinity : nil)
        .clipShape(.rect(cornerRadius: RememberDesign.controlRadius))
        .accessibilityHidden(true)
    }

    private var artworkSymbol: String {
        if imprint.sourceType == .note { return "quote.bubble.fill" }
        return imprint.isVideoSource ? "play.fill" : "text.document.fill"
    }
}
