import SwiftUI

/// Tokens and components for the attention-first redesign. See docs/REDESIGN.md.
enum RememberDesign {
    static let spacingXXSmall = 4.0
    static let spacingSmall = 8.0
    static let spacingCompact = 12.0
    static let spacing = 16.0
    static let spacingLarge = 24.0
    static let spacingXLarge = 32.0

    static let controlRadius = 18.0
    static let cornerRadius = 22.0
    static let sheetRadius = 28.0

    static let canvas = Color(red: 0.043, green: 0.043, blue: 0.051)
    static let card = Color(red: 0.094, green: 0.094, blue: 0.110)
    static let cardRaised = Color(red: 0.137, green: 0.137, blue: 0.161)
    static let line = Color(red: 0.180, green: 0.180, blue: 0.208)
    static let text2 = Color.white.opacity(0.64)
    static let text3 = Color.white.opacity(0.40)
    static let danger = Color(red: 1.0, green: 0.365, blue: 0.365)
    static let accent = Color.accentColor
    static let accentInk = Color("AccentInk")

    // Names kept for screens that predate the redesign.
    static let surface = card
    static let surfaceRaised = cardRaised
    static let mutedFill = cardRaised
    static let focusSurface = card
    static let secondaryText = text2
    static let tertiaryText = text3
    static let focusSecondaryText = text2

    static let primaryHeight = 60.0
    static let secondaryHeight = 52.0
    static let rowHeight = 56.0
}

// MARK: - Type

extension Font {
    static let rememberScreenTitle = Font.system(.largeTitle, design: .rounded).weight(.bold)
    static let rememberHero = Font.system(.title, design: .rounded).weight(.bold)
    static let rememberSectionTitle = Font.system(.title3, design: .rounded).weight(.bold)
    static let rememberRowTitle = Font.body.weight(.semibold)
    static let rememberMeta = Font.footnote.weight(.medium)
    static let rememberEyebrow = Font.footnote.weight(.bold)
}

// MARK: - Buttons (only three kinds)

struct RememberPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(RememberDesign.canvas)
            .frame(maxWidth: .infinity, minHeight: RememberDesign.primaryHeight)
            .padding(.horizontal, RememberDesign.spacing)
            .background(.white.opacity(isEnabled ? 1 : 0.4), in: .capsule)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
            .contentShape(.capsule)
    }
}

struct RememberSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: RememberDesign.secondaryHeight)
            .padding(.horizontal, RememberDesign.spacing)
            .background(configuration.isPressed ? RememberDesign.line : RememberDesign.cardRaised, in: .capsule)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
            .contentShape(.capsule)
    }
}

struct RememberQuietButtonStyle: ButtonStyle {
    var color: Color = RememberDesign.text2

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(color)
            .frame(minHeight: 44)
            .padding(.horizontal, RememberDesign.spacingSmall)
            .opacity(configuration.isPressed ? 0.5 : 1)
            .contentShape(.rect)
    }
}

extension ButtonStyle where Self == RememberPrimaryButtonStyle {
    static var rememberPrimary: RememberPrimaryButtonStyle { .init() }
}

extension ButtonStyle where Self == RememberSecondaryButtonStyle {
    static var rememberSecondary: RememberSecondaryButtonStyle { .init() }
}

extension ButtonStyle where Self == RememberQuietButtonStyle {
    static var rememberQuiet: RememberQuietButtonStyle { .init() }
    static var rememberDanger: RememberQuietButtonStyle { .init(color: RememberDesign.danger) }
}

// MARK: - Surfaces

extension View {
    func rememberSurface(padding: CGFloat = RememberDesign.spacing) -> some View {
        self
            .padding(padding)
            .background(RememberDesign.card, in: .rect(cornerRadius: RememberDesign.cornerRadius))
    }

    func rememberCard(padding: CGFloat = RememberDesign.spacingLarge) -> some View {
        rememberSurface(padding: padding)
    }
}

struct SectionHeading: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased())
                .font(.rememberEyebrow)
                .tracking(0.8)
                .foregroundStyle(RememberDesign.text2)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.rememberMeta)
                    .foregroundStyle(RememberDesign.text3)
            }
        }
        .padding(.horizontal, RememberDesign.spacingXXSmall)
        .accessibilityAddTraits(.isHeader)
    }
}

struct MetaChip: View {
    let text: String
    var systemImage: String?
    var isAccent = false

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small)
            }
            Text(text)
        }
        .font(.rememberMeta)
        .foregroundStyle(isAccent ? RememberDesign.accentInk : RememberDesign.text2)
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(isAccent ? RememberDesign.accent : RememberDesign.cardRaised, in: .capsule)
    }
}

struct RememberEmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: RememberDesign.spacingCompact) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(RememberDesign.accent)
                .frame(width: 72, height: 72)
                .background(RememberDesign.card, in: .circle)
                .accessibilityHidden(true)
            Text(title)
                .font(.rememberSectionTitle)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(RememberDesign.text2)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.rememberSecondary)
                    .frame(maxWidth: 260)
                    .padding(.top, RememberDesign.spacingSmall)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RememberDesign.spacingXLarge)
        .padding(.horizontal, RememberDesign.spacingLarge)
    }
}

// MARK: - Header

/// Large, left-aligned screen title with the profile avatar as the only top-right control.
struct RememberHeader<Accessory: View>: View {
    @Environment(AppStore.self) private var store
    let title: String
    @ViewBuilder var accessory: Accessory

    init(_ title: String, @ViewBuilder accessory: () -> Accessory = { EmptyView() }) {
        self.title = title
        self.accessory = accessory()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            HStack(alignment: .center) {
                Text(title)
                    .font(.rememberScreenTitle)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button {
                    store.selectedTab = .settings
                } label: {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 30))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(RememberDesign.text2)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Profile and settings")
                .accessibilityIdentifier("remember.global.settings")
            }
            accessory
        }
        .padding(.horizontal, RememberDesign.spacing)
        .padding(.top, RememberDesign.spacingSmall)
        .padding(.bottom, RememberDesign.spacingSmall)
        .background(RememberDesign.canvas)
    }
}

// MARK: - Bottom dock: add bar + toast, pinned above the tab bar

extension View {
    /// Pins the screen's single add bar (and the app toast) just above the tab bar.
    func rememberBottomDock<Bar: View>(@ViewBuilder _ bar: () -> Bar) -> some View {
        let bar = bar()
        return safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: RememberDesign.spacingSmall) {
                ToastHost()
                bar
            }
            .padding(.horizontal, RememberDesign.spacing)
            .padding(.top, RememberDesign.spacingSmall)
            .padding(.bottom, RememberDesign.spacingSmall)
            .background {
                RememberDesign.canvas
                    .ignoresSafeArea(edges: .bottom)
                    .overlay(alignment: .top) {
                        // A short fade so scrolling content slides under the dock instead of being cut off.
                        LinearGradient(colors: [RememberDesign.canvas.opacity(0), RememberDesign.canvas], startPoint: .top, endPoint: .bottom)
                            .frame(height: 24)
                            .offset(y: -24)
                    }
                    .allowsHitTesting(false)
            }
        }
    }

    func rememberBottomDock() -> some View {
        rememberBottomDock { EmptyView() }
    }
}

struct ToastHost: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if let toast = store.toast {
                ToastView(toast: toast)
                    .id(toast.id)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy(duration: 0.25), value: store.toast?.id)
    }
}

private struct ToastView: View {
    @Environment(AppStore.self) private var store
    let toast: AppToast

    var body: some View {
        HStack(spacing: RememberDesign.spacingCompact) {
            Image(systemName: toast.isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .foregroundStyle(toast.isError ? RememberDesign.danger : RememberDesign.accent)
                .accessibilityHidden(true)
            Text(toast.message)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let undo = toast.undo {
                Button("Undo") {
                    store.dismissToast(toast.id)
                    Task { await undo() }
                }
                .font(.subheadline.weight(.bold))
                .foregroundStyle(RememberDesign.accent)
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityIdentifier("remember.toast.undo")
            }
        }
        .padding(.leading, RememberDesign.spacing)
        .padding(.trailing, toast.undo == nil ? RememberDesign.spacing : RememberDesign.spacingSmall)
        .frame(minHeight: 52)
        .background(RememberDesign.cardRaised, in: .capsule)
        .shadow(color: .black.opacity(0.4), radius: 16, y: 6)
        // Contain, not combine: combining folds Undo into the message, so activating it missed the button.
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.updatesFrequently)
        .task(id: toast.id) {
            AccessibilityNotification.Announcement(toast.message).post()
            try? await Task.sleep(for: .seconds(5))
            store.dismissToast(toast.id)
        }
    }
}

// MARK: - Add bar

/// The one big white bar at the bottom of every screen. Type or speak, press return.
struct AddBar: View {
    let placeholder: String
    var parsesTasks = false
    var allowsDictation = true
    var accessibilityIdentifier = "remember.addbar"
    let onSubmit: (String) async -> Bool

    @State private var text = ""
    @State private var isSaving = false
    @State private var savedCount = 0
    @State private var failedCount = 0
    @State private var dictation = SpeechDictation()
    @FocusState private var isFocused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: RememberDesign.spacingSmall) {
            if parsesTasks, !trimmed.isEmpty {
                ParsePreview(parsed: QuickTaskParser.parse(trimmed))
            }
            HStack(spacing: RememberDesign.spacingSmall) {
                TextField(
                    "",
                    text: $text,
                    prompt: Text(dictation.isListening ? "Listening…" : placeholder).foregroundStyle(.black.opacity(0.45)),
                    axis: .vertical
                )
                .font(.body.weight(.medium))
                .lineLimit(1...3)
                .foregroundStyle(.black)
                .tint(.black)
                .focused($isFocused)
                .submitLabel(.send)
                .onSubmit(submit)
                .onChange(of: text) { _, value in
                    // Return in a vertical field inserts a newline; treat it as submit.
                    if value.contains("\n") {
                        text = value.replacingOccurrences(of: "\n", with: "")
                        submit()
                    } else if value.count > 300 {
                        text = String(value.prefix(300))
                    }
                }
                .onChange(of: dictation.transcript) { _, spoken in
                    if dictation.isListening { text = spoken }
                }
                .accessibilityLabel(placeholder)
                .accessibilityIdentifier(accessibilityIdentifier)
                .disabled(isSaving)

                trailingButton
            }
            .padding(.leading, 20)
            .padding(.trailing, 6)
            .frame(minHeight: 56)
            .background(.white, in: .rect(cornerRadius: 28))
            .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
            .contentShape(.rect(cornerRadius: 28))
            .onTapGesture { isFocused = true }
        }
        .sensoryFeedback(.success, trigger: savedCount)
        .sensoryFeedback(.error, trigger: failedCount)
        .animation(.snappy(duration: 0.2), value: trimmed.isEmpty)
    }

    @ViewBuilder
    private var trailingButton: some View {
        if isSaving {
            ProgressView()
                .tint(.black)
                .frame(width: 44, height: 44)
        } else if !trimmed.isEmpty && !dictation.isListening {
            Button(action: submit) {
                Image(systemName: "arrow.up")
                    .font(.body.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.black, in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add")
            .accessibilityIdentifier("\(accessibilityIdentifier).send")
            .transition(.scale.combined(with: .opacity))
        } else if allowsDictation {
            Button {
                Task { await toggleDictation() }
            } label: {
                Image(systemName: dictation.isListening ? "stop.fill" : "mic.fill")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(dictation.isListening ? .white : .black.opacity(0.7))
                    .frame(width: 44, height: 44)
                    .background(dictation.isListening ? Color.red : Color.black.opacity(0.06), in: .circle)
                    .symbolEffect(.pulse, isActive: dictation.isListening)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(dictation.isListening ? "Stop and add" : "Speak")
            .accessibilityIdentifier("\(accessibilityIdentifier).mic")
        }
    }

    private func toggleDictation() async {
        if dictation.isListening {
            dictation.stop()
            submit()
        } else {
            isFocused = false
            if !(await dictation.start()) {
                failedCount += 1
            }
        }
    }

    private func submit() {
        let value = trimmed
        guard !value.isEmpty, !isSaving else { return }
        if dictation.isListening { dictation.stop() }
        isSaving = true
        Task {
            let succeeded = await onSubmit(value)
            isSaving = false
            if succeeded {
                text = ""
                savedCount += 1
            } else {
                failedCount += 1
            }
        }
    }
}

/// Read-only chips that show what the quick-add parser understood.
private struct ParsePreview: View {
    let parsed: ParsedQuickTask

    var body: some View {
        if parsed.hasDetails {
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    if let minutes = parsed.durationMinutes {
                        MetaChip(text: minutes.durationLabel, systemImage: "timer", isAccent: true)
                    }
                    if let start = parsed.notBefore {
                        MetaChip(text: start.relativeDayLabel, systemImage: "calendar", isAccent: true)
                    }
                    if let due = parsed.dueAt {
                        MetaChip(text: "Due \(due.relativeDayLabel)", systemImage: "flag.fill", isAccent: true)
                    }
                    if let days = parsed.repeatEveryDays {
                        MetaChip(text: days.repeatLabel, systemImage: "repeat", isAccent: true)
                    }
                    if let priority = parsed.priority, priority == .high || priority == .must {
                        MetaChip(text: priority == .must ? "Urgent" : "Important", systemImage: "exclamationmark", isAccent: true)
                    }
                }
                .padding(.horizontal, 4)
            }
            .scrollIndicators(.hidden)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Understood")
        }
    }
}

/// A white bar that performs an action instead of taking text (for example, choosing a file).
struct QuickAddBar: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: RememberDesign.spacingCompact) {
                Image(systemName: systemImage)
                    .font(.body.weight(.bold))
                    .frame(width: 24)
                Text(title)
                    .font(.body.weight(.semibold))
                Spacer()
            }
            .foregroundStyle(.black)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(.white, in: .rect(cornerRadius: 28))
            .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

// MARK: - Formatting

extension Int {
    var durationLabel: String {
        if self < 60 { return "\(self) min" }
        let hours = self / 60, minutes = self % 60
        return minutes == 0 ? "\(hours) hr" : "\(hours) hr \(minutes) min"
    }

    var repeatLabel: String {
        switch self {
        case 1: "Daily"
        case 7: "Weekly"
        case 14: "Every 2 weeks"
        case 30: "Monthly"
        default: "Every \(self) days"
        }
    }
}

extension Date {
    /// "Tonight 6 PM", "Tomorrow", "Thu 9 AM", "Oct 3".
    var relativeDayLabel: String {
        let calendar = Calendar.current
        let time = formatted(.dateTime.hour().minute(.twoDigits))
            .replacingOccurrences(of: ":00", with: "")
        if calendar.isDateInToday(self) {
            return calendar.component(.hour, from: self) >= 17 ? "Tonight \(time)" : "Today \(time)"
        }
        if calendar.isDateInTomorrow(self) {
            return calendar.component(.hour, from: self) == 9 ? "Tomorrow" : "Tomorrow \(time)"
        }
        if let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: .now), to: self).day, days < 7 {
            let weekday = formatted(.dateTime.weekday(.abbreviated))
            return calendar.component(.hour, from: self) == 9 ? weekday : "\(weekday) \(time)"
        }
        return formatted(.dateTime.month(.abbreviated).day())
    }
}
