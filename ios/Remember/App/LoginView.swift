import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?
    @AccessibilityFocusState private var signInErrorIsFocused: Bool

    private enum Field: Hashable { case email, password }

    var body: some View {
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
                        .font(.rememberScreenTitle)
                    Text("Sign in to pick up where you left off.")
                        .font(.body)
                        .foregroundStyle(RememberDesign.text2)
                }

                form
            }
            .frame(maxWidth: 460, minHeight: 700, alignment: .top)
            .padding(.horizontal, RememberDesign.spacingLarge)
            .padding(.vertical, RememberDesign.spacingLarge)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(RememberDesign.canvas)
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
                .padding(.horizontal, 20)
                .frame(minHeight: 56)
                .background(RememberDesign.card, in: .capsule)
            SecureField("Password", text: $password)
                .textContentType(.password)
                .focused($focusedField, equals: .password)
                .submitLabel(.go)
                .onSubmit(signIn)
                .padding(.horizontal, 20)
                .frame(minHeight: 56)
                .background(RememberDesign.card, in: .capsule)
            if let error = store.signInError {
                Label(error, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(RememberDesign.danger)
                    .accessibilityFocused($signInErrorIsFocused)
            }
            Button(action: signIn) {
                if store.isSigningIn { ProgressView().tint(RememberDesign.canvas) }
                else { Text("Sign in") }
            }
            .buttonStyle(.rememberPrimary)
            .padding(.top, RememberDesign.spacingSmall)
            .disabled(email.isEmpty || password.isEmpty || store.isSigningIn)
            Label("Private, encrypted session", systemImage: "lock.fill")
                .font(.rememberMeta)
                .foregroundStyle(RememberDesign.text3)
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
