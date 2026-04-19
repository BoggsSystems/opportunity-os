import AVFoundation
import Foundation
import Speech

@MainActor
final class NativeSpeechRecognitionService: NSObject, SpeechRecognitionServiceProtocol {
    var onSpeechDetected: (() -> Void)? = nil
    var activeSynthesizedText: String? = nil {
        didSet {
            if activeSynthesizedText != nil {
                lastSynthesisStartTime = Date()
            }
        }
    }
    private var lastSynthesisStartTime: Date?
    private let audioEngine = AVAudioEngine()
    private let recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var transcript = ""
    private var utteranceContinuation: CheckedContinuation<String, Error>?
    private var speechDetected = false

    // Workaround: Silence detection for when result.isFinal is never invoked
    private var silenceTimer: Timer?
    private let silenceTimeout: TimeInterval = 2.0 // Force finalize after 2 seconds of silence
    private var lastTranscriptUpdate = Date()

    override init() {
        self.recognizer = SFSpeechRecognizer(locale: Locale(identifier: Locale.current.identifier))
        super.init()
        debugTrace("SpeechRecognition", "initialized with locale=\(Locale.current.identifier), recognizerAvailable=\(recognizer?.isAvailable == true)")
    }

    func startListening() async throws {
        try await requestAuthorizationIfNeeded()
        debugTrace("SpeechRecognition", "startListening invoked")
        try configureAndStartRecognition()
    }

    func listenForUtterance() async throws -> String {
        try await requestAuthorizationIfNeeded()
        debugTrace("SpeechRecognition", "listenForUtterance invoked")
        try configureAndStartRecognition()

        return try await withCheckedThrowingContinuation { continuation in
            self.utteranceContinuation = continuation
        }
    }

    func stopListening() async {
        stopSilenceTimer()
        recognitionTask?.finish()
        finishListeningSession(returning: transcript)
    }

    func latestTranscript() async -> String {
        transcript
    }

    private func requestAuthorizationIfNeeded() async throws {
        let status = SFSpeechRecognizer.authorizationStatus()
        debugTrace("SpeechRecognition", "authorization status=\(String(describing: status.rawValue))")
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
                debugTrace("SpeechRecognition", "authorization denied after prompt")
                throw APIClientError.server(message: "Speech recognition permission was not granted.")
            }
            debugTrace("SpeechRecognition", "authorization granted after prompt")
        case .denied:
            debugTrace("SpeechRecognition", "authorization denied by system settings")
            throw APIClientError.server(message: "Speech recognition access is denied for this app.")
        case .restricted:
            debugTrace("SpeechRecognition", "authorization restricted on this device")
            throw APIClientError.server(message: "Speech recognition is restricted on this device.")
        @unknown default:
            debugTrace("SpeechRecognition", "authorization returned unknown status")
            throw APIClientError.server(message: "Speech recognition is unavailable.")
        }
    }

    private func configureAndStartRecognition() throws {
        guard let recognizer, recognizer.isAvailable else {
            debugTrace("SpeechRecognition", "recognizer unavailable at configure/start")
            throw APIClientError.server(message: "Speech recognition is currently unavailable.")
        }

        transcript = ""
        speechDetected = false
        recognitionTask?.cancel()
        recognitionTask = nil
        utteranceContinuation = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        debugTrace("SpeechRecognition", "audio session activated for recording and playback")

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        
        // Solution #1: Enable Native Voice Processing (Hardware AEC)
        do {
            try inputNode.setVoiceProcessingEnabled(true)
            debugTrace("SpeechRecognition", "Native voice processing (AEC) enabled")
        } catch {
            debugTrace("SpeechRecognition", "Failed to enable native voice processing: \(error.localizedDescription)")
        }

        let format = inputNode.outputFormat(forBus: 0)
        
        // Solution #2: High-Pass Filter (Spectral Subtraction of rumble)
        let eqNode = AVAudioUnitEQ(numberOfBands: 1)
        let filterBand = eqNode.bands[0]
        filterBand.filterType = .highPass
        filterBand.frequency = 300.0 // Cut off low-frequency speaker rumble
        filterBand.bypass = false
        
        audioEngine.attach(eqNode)
        audioEngine.connect(inputNode, to: eqNode, format: format)
        
        eqNode.removeTap(onBus: 0)
        eqNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            if let self {
                if self.transcript.isEmpty {
                    debugTrace("SpeechRecognition", "receiving audio buffers (filtered)")
                }
            }
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            if let result {
                self.transcript = result.bestTranscription.formattedString
                debugTrace(
                    "SpeechRecognition",
                    "🔍 DEBUG: result.isFinal=\(result.isFinal) text=\(result.bestTranscription.formattedString)"
                )
                
                let trimmed = self.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
                let words = trimmed.split(separator: " ")
                
                // Barge-in threshold: At least 2 words or >4 characters to prevent noise loops
                let isSignificantSpeech = words.count >= 2 || trimmed.count > 4
                
                // Software Echo Cancellation:
                var isEcho = false
                if let activeText = self.activeSynthesizedText, isSignificantSpeech {
                    let cleanTranscriptWords = trimmed.lowercased()
                        .filter { $0.isLetter || $0.isWhitespace }
                        .split(separator: " ")
                        .map(String.init)
                        
                    let cleanActiveWords = activeText.lowercased()
                        .filter { $0.isLetter || $0.isWhitespace }
                        .split(separator: " ")
                        .map(String.init)
                    
                    let activeString = cleanActiveWords.joined(separator: " ")
                    let transcriptString = cleanTranscriptWords.joined(separator: " ")
                    
                    if activeString.contains(transcriptString) && !transcriptString.isEmpty {
                        isEcho = true
                        debugTrace("SpeechRecognition", "🗣️ IGNORED ECHO: Transcript is exact substring of AI speech")
                    } else {
                        // Check for distinct novelty (ignoring common stop words)
                        let stopWords: Set<String> = [
                            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", 
                            "is", "are", "was", "were", "am", "be", "been", "being",
                            "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
                            "my", "your", "his", "their", "our", "its",
                            "have", "has", "had", "do", "does", "did",
                            "can", "could", "will", "would", "shall", "should", "may", "might", "must",
                            "what", "who", "where", "when", "why", "how", "which",
                            "so", "if", "then", "else", "as", "than", "because", "while", "until",
                            "just", "about", "like", "some", "any", "all", "no", "not", "yes",
                            "im", "dont", "cant", "wont", "ill", "youre", "theyre", "weve"
                        ]
                        
                        let activeDistinct = Set(cleanActiveWords).subtracting(stopWords)
                        let transcriptDistinct = Set(cleanTranscriptWords).subtracting(stopWords)
                        
                        let novelDistinctWords = transcriptDistinct.subtracting(activeDistinct)
                        
                        if novelDistinctWords.isEmpty {
                            isEcho = true
                            debugTrace("SpeechRecognition", "🗣️ IGNORED ECHO: Transcript contains 0 novel distinctive words")
                        } else if novelDistinctWords.count == 1 && cleanTranscriptWords.count > 3 {
                            // If it's a longer phrase but only has 1 novel distinctive word, it's likely a hallucinated echo
                            isEcho = true
                            debugTrace("SpeechRecognition", "🗣️ IGNORED ECHO: Only 1 novel word (\(novelDistinctWords.first!)) in long phrase")
                        } else if let startTime = self.lastSynthesisStartTime, Date().timeIntervalSince(startTime) < 1.5 {
                            // Grace Period: Ignore any barge-in within the first 1.5 seconds of the AI speaking
                            isEcho = true
                            debugTrace("SpeechRecognition", "🗣️ IGNORED ECHO: Inside 1.5s grace period (\(String(format: "%.1f", Date().timeIntervalSince(startTime)))s elapsed)")
                        } else {
                            debugTrace("SpeechRecognition", "🎙️ BARGE-IN ALLOWED: Found novel distinctive words: \(novelDistinctWords)")
                        }
                    }
                }
                
                if !self.speechDetected && isSignificantSpeech && !isEcho {
                    self.speechDetected = true
                    Task { @MainActor in
                        self.onSpeechDetected?()
                    }
                }

                // Call completion callback when speech recognition finishes
                if result.isFinal {
                    debugTrace("SpeechRecognition", "✅ SUCCESS: result.isFinal=true, calling finishListeningSession")
                    Task { @MainActor in
                        self.finishListeningSession(returning: self.transcript)
                    }
                } else {
                    debugTrace("SpeechRecognition", "⏳ PARTIAL: result.isFinal=false, continuing to listen")
                    // Workaround: Reset silence timer on each partial result
                    // This detects when user stops speaking and isFinal never fires
                    self.resetSilenceTimer()
                }
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
        // Stop silence detection timer
        silenceTimer?.invalidate()
        silenceTimer = nil

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error {
            debugTrace("SpeechRecognition", "🏁 VOICE COMPLETE: finishing with error=\(error.localizedDescription), transcript=\(trimmed)")
        } else {
            debugTrace("SpeechRecognition", "🏁 VOICE COMPLETE: finishing successfully with transcript=\(trimmed)")
        }
        recognitionTask?.cancel()
        recognitionTask = nil

        recognitionRequest?.endAudio()
        recognitionRequest = nil

        if audioEngine.isRunning {
            audioEngine.stop()
            // Cleanup EQ node and taps
            for node in audioEngine.attachedNodes {
                if node is AVAudioUnitEQ {
                    node.removeTap(onBus: 0)
                    audioEngine.detach(node)
                }
            }
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        guard let continuation = utteranceContinuation else {
            debugTrace("SpeechRecognition", "❌ VOICE ERROR: no continuation to resume - transcript lost!")
            return
        }

        utteranceContinuation = nil

        if let error, value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            continuation.resume(throwing: error)
            return
        }

        continuation.resume(returning: value)
    }

    // MARK: - Silence Detection Workaround

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        lastTranscriptUpdate = Date()

        silenceTimer = Timer.scheduledTimer(withTimeInterval: silenceTimeout, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let timeSinceLastUpdate = Date().timeIntervalSince(self.lastTranscriptUpdate)

                // Only finalize if we've been silent for the full timeout period
                // and we have some transcript content
                if timeSinceLastUpdate >= self.silenceTimeout && !self.transcript.isEmpty {
                    debugTrace(
                        "SpeechRecognition",
                        "🔔 SILENCE TIMEOUT: Force finalizing after \(Int(self.silenceTimeout))s of silence (result.isFinal never fired)"
                    )
                    self.finishListeningSession(returning: self.transcript)
                }
            }
        }
    }

    private func stopSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = nil
    }
}
