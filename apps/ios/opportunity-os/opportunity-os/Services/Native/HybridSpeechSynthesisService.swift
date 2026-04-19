import AVFoundation
import Foundation

@MainActor
final class HybridSpeechSynthesisService: NSObject, SpeechSynthesisServiceProtocol, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    private let apiClient: OpportunityOSAPIClient
    private let sessionManager: SessionManager
    private let nativeSynthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var queueDrainedContinuation: CheckedContinuation<Void, Never>?
    private var isRemoteActive = false
    private var queuedUtteranceCount = 0

    init(apiClient: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.apiClient = apiClient
        self.sessionManager = sessionManager
        super.init()
        nativeSynthesizer.delegate = self
    }

    func speak(_ text: String, preference: VoicePreference) async {
        debugTrace("SpeechSynthesis", "🎤 HYBRID: speak requested text=\(text.prefix(160))")
        await stopSpeaking()
        
        // Attempt Remote OpenAI TTS
        do {
            try await playRemoteSpeech(text, preference: preference)
        } catch {
            debugTrace("SpeechSynthesis", "⚠️ HYBRID: Remote TTS failed, falling back to Native: \(error.localizedDescription)")
            await enqueueSpeech(text, preference: preference)
            await waitForSpeechQueue()
        }
        
        debugTrace("SpeechSynthesis", "🎤 HYBRID: speak completed")
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
        guard (queuedUtteranceCount > 0 || nativeSynthesizer.isSpeaking) || isRemoteActive else { return }
        
        await withCheckedContinuation { continuation in
            self.queueDrainedContinuation = continuation
        }
    }

    func stopSpeaking() async {
        if nativeSynthesizer.isSpeaking {
            nativeSynthesizer.stopSpeaking(at: .immediate)
        }
        
        audioPlayer?.stop()
        audioPlayer = nil
        isRemoteActive = false
        
        queuedUtteranceCount = 0
        queueDrainedContinuation?.resume()
        queueDrainedContinuation = nil
    }

    private func playRemoteSpeech(_ text: String, preference: VoicePreference) async throws {
        isRemoteActive = true
        
        configurePlaybackAudioSession()
        
        // Fetch binary audio from backend
        let audioData = try await apiClient.postBinary(
            "ai/tts",
            body: ["text": text, "voice": "nova"], // Switched to 'nova' to make the change obvious
            accessToken: sessionManager.session?.accessToken
        )
        
        // Play using AVAudioPlayer
        audioPlayer = try AVAudioPlayer(data: audioData)
        audioPlayer?.delegate = self
        audioPlayer?.prepareToPlay()
        
        await withCheckedContinuation { continuation in
            self.queueDrainedContinuation = continuation
            audioPlayer?.play()
        }
        
        isRemoteActive = false
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

    // MARK: - Audio Player Delegate
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.queueDrainedContinuation?.resume()
            self.queueDrainedContinuation = nil
        }
    }
}

