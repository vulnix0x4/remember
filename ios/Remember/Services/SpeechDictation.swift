import AVFoundation
import Observation
import Speech

/// Tap-to-talk dictation for the add bar. Prefers on-device recognition.
@Observable @MainActor
final class SpeechDictation {
    private(set) var isListening = false
    private(set) var transcript = ""

    @ObservationIgnored private var engine: AVAudioEngine?
    @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
    @ObservationIgnored private var task: SFSpeechRecognitionTask?

    /// Returns false when permission is denied or recognition is unavailable.
    func start() async -> Bool {
        guard !isListening else { return true }
        guard await Self.requestSpeechAuthorization(),
              await AVAudioApplication.requestRecordPermission(),
              let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else { return false }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            return false
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = false
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }

        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        Self.installTap(on: input, format: format, feeding: request)
        engine.prepare()
        do { try engine.start() } catch {
            input.removeTap(onBus: 0)
            return false
        }

        transcript = ""
        self.engine = engine
        self.request = request
        isListening = true
        task = Self.recognize(with: recognizer, request: request) { [weak self] text, finished in
            guard let self else { return }
            if let text { self.transcript = text }
            if finished { self.stop() }
        }
        return true
    }

    // Audio and recognition callbacks arrive off the main thread, so they are built outside main-actor isolation.
    nonisolated private static func installTap(on input: AVAudioInputNode, format: AVAudioFormat, feeding request: SFSpeechAudioBufferRecognitionRequest) {
        nonisolated(unsafe) let request = request
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
    }

    nonisolated private static func recognize(
        with recognizer: SFSpeechRecognizer,
        request: SFSpeechAudioBufferRecognitionRequest,
        update: @escaping @MainActor @Sendable (String?, Bool) -> Void
    ) -> SFSpeechRecognitionTask {
        recognizer.recognitionTask(with: request) { result, error in
            let text = result?.bestTranscription.formattedString
            let finished = error != nil || (result?.isFinal ?? false)
            Task { @MainActor in update(text, finished) }
        }
    }

    func stop() {
        guard isListening else { return }
        isListening = false
        engine?.stop()
        engine?.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.finish()
        engine = nil
        request = nil
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private static func requestSpeechAuthorization() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
            }
        default: return false
        }
    }
}
