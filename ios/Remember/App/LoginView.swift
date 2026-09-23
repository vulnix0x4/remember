import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?
    @AccessibilityFocusState private var signInErrorIsFocused: Bool

    private enum Field: Hashable { case email, password }

    var body: some View {
        ZStack {
            WarmBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: RememberDesign.spacingXLarge) {
                    HStack(spacing: 12) {
                        RememberMark(size: 42)
                        Text("Remember")
                            .font(.headline)
                    }
                    .accessibilityElement(children: .combine)

                    Spacer(minLength: 52)

                    VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
                        Text("Welcome back")
                            .font(.largeTitle.bold())
                        Text("Sign in to continue to your saves and plans.")
                            .font(.body)
                            .foregroundStyle(RememberDesign.secondaryText)
                    }

                    form
                }
                .frame(maxWidth: 460, minHeight: 700, alignment: .top)
                .padding(.horizontal, RememberDesign.spacingLarge)
                .padding(.vertical, RememberDesign.spacingLarge)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacing) {
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .email)
                .submitLabel(.next)
                .onSubmit { focusedField = .password }
                .padding(.horizontal, RememberDesign.spacing)
                .frame(minHeight: 54)
                .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
            SecureField("Password", text: $password)
                .textContentType(.password)
                .focused($focusedField, equals: .password)
                .submitLabel(.go)
                .onSubmit(signIn)
                .padding(.horizontal, RememberDesign.spacing)
                .frame(minHeight: 54)
                .background(RememberDesign.surface, in: .rect(cornerRadius: RememberDesign.controlRadius))
            if let error = store.signInError {
                Label(error, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
                    .accessibilityFocused($signInErrorIsFocused)
            }
            Button(action: signIn) {
                Group {
                    if store.isSigningIn { ProgressView().tint(RememberDesign.accentInk) }
                    else { Text("Sign in") }
                }
                .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.plain)
            .bold()
            .foregroundStyle(RememberDesign.accentInk)
            .background(RememberDesign.accent, in: .rect(cornerRadius: 14))
            .disabled(email.isEmpty || password.isEmpty || store.isSigningIn)
            .opacity(email.isEmpty || password.isEmpty ? 0.55 : 1)
            Label("Private, encrypted session", systemImage: "lock.fill")
                .font(.caption)
                .foregroundStyle(RememberDesign.tertiaryText)
                .frame(maxWidth: .infinity)
        }
        .onChange(of: store.signInError) { _, error in
            signInErrorIsFocused = error != nil
        }
    }

    private func signIn() {
        signInErrorIsFocused = false
        Task { await store.signIn(email: email, password: password) }
    }
}
