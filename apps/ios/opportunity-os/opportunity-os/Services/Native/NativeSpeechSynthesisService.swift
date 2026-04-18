import AVFoundation
import Foundation

@MainActor
final class NativeSpeechSynthesisService: NSObject, SpeechSynthesisServiceProtocol, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private var queueDrainedContinuation: CheckedContinuation<Void, Never>?
    private var queuedUtteranceCount = 0

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, preference: VoicePreference) async {
        #if DEBUG
        print("[NativeSpeechSynthesisService] speak requested: \(text.prefix(160))")
        #endif
        await stopSpeaking()
        await enqueueSpeech(text, preference: preference)
        await waitForSpeechQueue()
        #if DEBUG
        print("[NativeSpeechSynthesisService] speak completed")
        #endif
    }

    func enqueueSpeech(_ text: String, preference: VoicePreference) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        configurePlaybackAudioSession()
        #if DEBUG
        print("[NativeSpeechSynthesisService] enqueueSpeech with locale \(preference.localeIdentifier), rate \(preference.speakingRate)")
        #endif

        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.voice = AVSpeechSynthesisVoice(language: preference.localeIdentifier)
            ?? AVSpeechSynthesisVoice(language: Locale.current.identifier)
        utterance.rate = Float(min(max(preference.speakingRate, 0.35), 0.6))

        queuedUtteranceCount += 1
        synthesizer.speak(utterance)
    }

    func waitForSpeechQueue() async {
        guard queuedUtteranceCount > 0 || synthesizer.isSpeaking else { return }

        await withCheckedContinuation { continuation in
            self.queueDrainedContinuation = continuation
        }
    }

    func stopSpeaking() async {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }

        queuedUtteranceCount = 0
        queueDrainedContinuation?.resume()
        queueDrainedContinuation = nil
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.queuedUtteranceCount = max(0, self.queuedUtteranceCount - 1)
            if self.queuedUtteranceCount == 0 {
                self.queueDrainedContinuation?.resume()
                self.queueDrainedContinuation = nil
            }
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.queuedUtteranceCount = max(0, self.queuedUtteranceCount - 1)
            if self.queuedUtteranceCount == 0 {
                self.queueDrainedContinuation?.resume()
                self.queueDrainedContinuation = nil
            }
        }
    }

    private func configurePlaybackAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()

        do {
            try audioSession.setCategory(
                .playback,
                mode: .spokenAudio,
                options: [.duckOthers]
            )
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            #if DEBUG
            print("[NativeSpeechSynthesisService] failed to configure audio session: \(error.localizedDescription)")
            #endif
        }
    }
}
