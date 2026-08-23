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
            LinearGradient(
                colors: [RememberDesign.surfaceRaised, Color(red: 0.13, green: 0.27, blue: 0.20)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Circle()
                .fill(RememberDesign.accent.opacity(0.2))
                .blur(radius: 28)
                .frame(width: 110, height: 110)
                .offset(x: -72, y: -50)
            Circle()
                .stroke(RememberDesign.accent.opacity(0.24), lineWidth: 1)
                .frame(width: 210, height: 210)
                .offset(x: 116, y: 82)
            Circle()
                .stroke(RememberDesign.accent.opacity(0.2), lineWidth: 1)
                .frame(width: 150, height: 150)
                .offset(x: 116, y: 82)
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
                    colors: [.clear, .black.opacity(0.62)],
                    startPoint: .center,
                    endPoint: .bottom
                )
            }
            Image(systemName: imprint.isVideoSource ? "play.fill" : "text.document.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(.black.opacity(0.62), in: .rect(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.22)) }
        }
        .frame(width: width, height: height)
        .frame(maxWidth: width == nil ? .infinity : nil)
        .clipShape(.rect(cornerRadius: RememberDesign.cornerRadius))
        .overlay { RoundedRectangle(cornerRadius: RememberDesign.cornerRadius).stroke(RememberDesign.line) }
        .accessibilityHidden(true)
    }
}
