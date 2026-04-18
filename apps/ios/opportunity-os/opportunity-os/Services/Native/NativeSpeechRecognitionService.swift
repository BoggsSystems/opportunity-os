import AVFoundation
import Foundation
import Speech

@MainActor
final class NativeSpeechRecognitionService: NSObject, SpeechRecognitionServiceProtocol {
    private let audioEngine = AVAudioEngine()
    private let recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var transcript = ""
    private var utteranceContinuation: CheckedContinuation<String, Error>?

    override init() {
        self.recognizer = SFSpeechRecognizer(locale: Locale(identifier: Locale.current.identifier))
        super.init()
    }

    func startListening() async throws {
        try await requestAuthorizationIfNeeded()
        try configureAndStartRecognition()
    }

    func listenForUtterance() async throws -> String {
        try await requestAuthorizationIfNeeded()
        #if DEBUG
        print("[NativeSpeechRecognitionService] starting utterance capture")
        #endif
        try configureAndStartRecognition()

        return try await withCheckedThrowingContinuation { continuation in
            self.utteranceContinuation = continuation
        }
    }

    func stopListening() async {
        recognitionTask?.finish()
        finishListeningSession(returning: transcript)
    }

    func latestTranscript() async -> String {
        transcript
    }

    private func requestAuthorizationIfNeeded() async throws {
        let status = SFSpeechRecognizer.authorizationStatus()
        switch status {
        case .authorized:
            return
        case .notDetermined:
            let granted = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { authStatus in
                    continuation.resume(returning: authStatus == .authorized)
                }
            }
            if !granted {
                throw APIClientError.server(message: "Speech recognition permission was not granted.")
            }
        case .denied:
            throw APIClientError.server(message: "Speech recognition access is denied for this app.")
        case .restricted:
            throw APIClientError.server(message: "Speech recognition is restricted on this device.")
        @unknown default:
            throw APIClientError.server(message: "Speech recognition is unavailable.")
        }
    }

    private func configureAndStartRecognition() throws {
        guard let recognizer, recognizer.isAvailable else {
            throw APIClientError.server(message: "Speech recognition is currently unavailable.")
        }

        transcript = ""
        recognitionTask?.cancel()
        recognitionTask = nil
        utteranceContinuation = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            if let self {
                #if DEBUG
                if self.transcript.isEmpty {
                    print("[NativeSpeechRecognitionService] receiving audio buffers")
                }
                #endif
            }
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            if let result {
                self.transcript = result.bestTranscription.formattedString
            }

            if let error {
                Task { @MainActor in
                    self.finishListeningSession(returning: self.transcript, error: error)
                }
                return
            }

            if result?.isFinal == true {
                Task { @MainActor in
                    self.finishListeningSession(returning: self.transcript)
                }
            }
        }
    }

    private func finishListeningSession(returning value: String, error: Error? = nil) {
        #if DEBUG
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error {
            print("[NativeSpeechRecognitionService] finishing with error: \(error.localizedDescription); transcript: \(trimmed)")
        } else {
            print("[NativeSpeechRecognitionService] finishing with transcript: \(trimmed)")
        }
        #endif
        recognitionTask?.cancel()
        recognitionTask = nil

        recognitionRequest?.endAudio()
        recognitionRequest = nil

        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        guard let continuation = utteranceContinuation else {
            return
        }

        utteranceContinuation = nil

        if let error, value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            continuation.resume(throwing: error)
            return
        }

        continuation.resume(returning: value)
    }
}
