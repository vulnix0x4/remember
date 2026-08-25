import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    private enum Field: Hashable { case email, password }

    var body: some View {
        ZStack {
            WarmBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    brand
                    Spacer(minLength: 62)
                    story
                    Spacer(minLength: 48)
                    form
                }
                .frame(maxWidth: 520, minHeight: 720, alignment: .top)
                .padding(.horizontal, 22)
                .padding(.vertical, 28)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var brand: some View {
        Label {
            Text("Remember").font(.headline).bold()
        } icon: {
            RememberMark()
        }
    }

    private var story: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("YOUR PRIVATE ARCHIVE")
                .font(.caption)
                .bold()
                .tracking(1.5)
                .foregroundStyle(RememberDesign.accent)
            Text("What shaped you,\nkept close.")
                .font(.largeTitle)
                .bold()
                .tracking(-1.4)
            Text("Return to the ideas that mattered and notice what they are becoming.")
                .font(.body)
                .foregroundStyle(RememberDesign.secondaryText)
                .lineSpacing(4)
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Sign in").font(.title2).bold()
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .email)
                .submitLabel(.next)
                .onSubmit { focusedField = .password }
                .archiveField()
            SecureField("Password", text: $password)
                .textContentType(.password)
                .focused($focusedField, equals: .password)
                .submitLabel(.go)
                .onSubmit(signIn)
                .archiveField()
            if let error = store.signInError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
            }
            Button(action: signIn) {
                Group {
                    if store.isSigningIn { ProgressView().tint(RememberDesign.accentInk) }
                    else { Label("Enter your archive", systemImage: "arrow.right") }
                }
                .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.plain)
            .bold()
            .foregroundStyle(RememberDesign.accentInk)
            .background(RememberDesign.accent, in: .rect(cornerRadius: 14))
            .disabled(email.isEmpty || password.isEmpty || store.isSigningIn)
            .opacity(email.isEmpty || password.isEmpty ? 0.55 : 1)
            Label("Protected with a private, encrypted session", systemImage: "lock.fill")
                .font(.caption)
                .foregroundStyle(RememberDesign.tertiaryText)
                .frame(maxWidth: .infinity)
        }
        .padding(22)
        .background(RememberDesign.surface.opacity(0.9), in: .rect(cornerRadius: 24))
        .overlay { RoundedRectangle(cornerRadius: 24).stroke(RememberDesign.line) }
    }

    private func signIn() {
        Task { await store.signIn(email: email, password: password) }
    }
}

private extension View {
    func archiveField() -> some View {
        padding(.horizontal, 16)
            .frame(minHeight: 54)
            .background(RememberDesign.canvas, in: .rect(cornerRadius: 13))
            .overlay { RoundedRectangle(cornerRadius: 13).stroke(RememberDesign.line) }
    }
}
