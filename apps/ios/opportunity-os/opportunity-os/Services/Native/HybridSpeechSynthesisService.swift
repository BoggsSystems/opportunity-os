import AVFoundation
import Foundation

@MainActor
final class HybridSpeechSynthesisService: NSObject, SpeechSynthesisServiceProtocol, AVSpeechSynthesizerDelegate {
    private let apiClient: OpportunityOSAPIClient
    private let sessionManager: SessionManager
    private let nativeSynthesizer = AVSpeechSynthesizer()
    private let queuePlayer = AVQueuePlayer()
    private var queueDrainedContinuation: CheckedContinuation<Void, Never>?
    private var isRemoteActive = false
    private var queuedUtteranceCount = 0
    private var tempFiles: [URL] = []
    private var observerTokens: [Any] = []

    init(apiClient: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.apiClient = apiClient
        self.sessionManager = sessionManager
        super.init()
        nativeSynthesizer.delegate = self
        setupQueuePlayerObserver()
    }

    private func setupQueuePlayerObserver() {
        let token = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] notification in
            guard let self = self else { return }
            guard let item = notification.object as? AVPlayerItem, self.queuePlayer.items().contains(item) || self.queuePlayer.currentItem == item else { return }
            
            self.checkQueueState()
        }
        observerTokens.append(token)
    }

    func speak(_ text: String, preference: VoicePreference) async {
        debugTrace("SpeechSynthesis", "🎤 HYBRID: speak requested text=\(text.prefix(160))")
        await stopSpeaking()
        
        // Attempt Remote OpenAI TTS (Legacy full request)
        do {
            try await playRemoteSpeech(text, preference: preference)
        } catch {
            debugTrace("SpeechSynthesis", "⚠️ HYBRID: Remote TTS failed, falling back to Native: \(error.localizedDescription)")
            await enqueueSpeech(text, preference: preference)
            await waitForSpeechQueue()
        }
        
        debugTrace("SpeechSynthesis", "🎤 HYBRID: speak completed")
    }

    func enqueueAudioData(_ data: Data) async {
        isRemoteActive = true
        configurePlaybackAudioSession()
        
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp3")
        do {
            try data.write(to: tempURL)
            tempFiles.append(tempURL)
            let item = AVPlayerItem(url: tempURL)
            queuePlayer.insert(item, after: nil)
            queuePlayer.play()
        } catch {
            debugTrace("SpeechSynthesis", "failed to write audio chunk: \(error)")
        }
    }

    func enqueueSpeech(_ text: String, preference: VoicePreference) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        configurePlaybackAudioSession()
        
        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.voice = AVSpeechSynthesisVoice(language: preference.localeIdentifier)
            ?? AVSpeechSynthesisVoice(language: Locale.current.identifier)
        utterance.rate = Float(min(max(preference.speakingRate, 0.35), 0.6))

        queuedUtteranceCount += 1
        nativeSynthesizer.speak(utterance)
    }

    func waitForSpeechQueue() async {
        guard (queuedUtteranceCount > 0 || nativeSynthesizer.isSpeaking) || (queuePlayer.currentItem != nil) else { return }
        
        await withCheckedContinuation { continuation in
            self.queueDrainedContinuation = continuation
        }
    }

    func stopSpeaking() async {
        if nativeSynthesizer.isSpeaking {
            nativeSynthesizer.stopSpeaking(at: .immediate)
        }
        
        queuePlayer.removeAllItems()
        isRemoteActive = false
        queuedUtteranceCount = 0
        
        // Cleanup temp files
        for url in tempFiles {
            try? FileManager.default.removeItem(at: url)
        }
        tempFiles.removeAll()
        
        queueDrainedContinuation?.resume()
        queueDrainedContinuation = nil
    }

    private func playRemoteSpeech(_ text: String, preference: VoicePreference) async throws {
        isRemoteActive = true
        configurePlaybackAudioSession()
        
        let audioData = try await apiClient.postBinary(
            "ai/tts",
            body: ["text": text, "voice": "nova"],
            accessToken: sessionManager.session?.accessToken
        )
        
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp3")
        try audioData.write(to: tempURL)
        tempFiles.append(tempURL)
        
        let item = AVPlayerItem(url: tempURL)
        queuePlayer.insert(item, after: nil)
        queuePlayer.play()
        
        await waitForSpeechQueue()
        isRemoteActive = false
    }

    private func checkQueueState() {
        Task { @MainActor in
            if self.queuePlayer.items().isEmpty && self.queuePlayer.currentItem == nil {
                self.queueDrainedContinuation?.resume()
                self.queueDrainedContinuation = nil
            }
        }
    }

    private func configurePlaybackAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            debugTrace("SpeechSynthesis", "failed to configure playback audio session: \(error.localizedDescription)")
        }
    }

    // MARK: - Native Synthesizer Delegate
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.queuedUtteranceCount = max(0, self.queuedUtteranceCount - 1)
            if self.queuedUtteranceCount == 0 {
                self.queueDrainedContinuation?.resume()
                self.queueDrainedContinuation = nil
            }
        }
    }
}
