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
        debugTrace("SpeechSynthesis", "speak requested text=\(text.prefix(160))")
        await stopSpeaking()
        await enqueueSpeech(text, preference: preference)
        await waitForSpeechQueue()
        debugTrace("SpeechSynthesis", "speak completed")
    }

    func enqueueSpeech(_ text: String, preference: VoicePreference) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        configurePlaybackAudioSession()
        debugTrace(
            "SpeechSynthesis",
            "enqueueSpeech locale=\(preference.localeIdentifier), voice=\(preference.displayName), rate=\(preference.speakingRate), text=\(trimmed.prefix(160))"
        )

        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.voice = AVSpeechSynthesisVoice(language: preference.localeIdentifier)
            ?? AVSpeechSynthesisVoice(language: Locale.current.identifier)
        utterance.rate = Float(min(max(preference.speakingRate, 0.35), 0.6))

        queuedUtteranceCount += 1
        synthesizer.speak(utterance)
    }

    func waitForSpeechQueue() async {
        guard queuedUtteranceCount > 0 || synthesizer.isSpeaking else { return }
        debugTrace("SpeechSynthesis", "waiting for speech queue to drain; queuedCount=\(queuedUtteranceCount)")

        await withCheckedContinuation { continuation in
            self.queueDrainedContinuation = continuation
        }
    }

    func stopSpeaking() async {
        if synthesizer.isSpeaking {
            debugTrace("SpeechSynthesis", "stopSpeaking invoked while synthesizer active")
            synthesizer.stopSpeaking(at: .immediate)
        }

        queuedUtteranceCount = 0
        queueDrainedContinuation?.resume()
        queueDrainedContinuation = nil
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.queuedUtteranceCount = max(0, self.queuedUtteranceCount - 1)
            debugTrace("SpeechSynthesis", "utterance finished; remainingQueue=\(self.queuedUtteranceCount)")
            if self.queuedUtteranceCount == 0 {
                self.queueDrainedContinuation?.resume()
                self.queueDrainedContinuation = nil
            }
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.queuedUtteranceCount = max(0, self.queuedUtteranceCount - 1)
            debugTrace("SpeechSynthesis", "utterance cancelled; remainingQueue=\(self.queuedUtteranceCount)")
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
                .playAndRecord,
                mode: .voiceChat,
                options: [.duckOthers, .defaultToSpeaker, .allowBluetooth]
            )
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            debugTrace("SpeechSynthesis", "failed to configure playback audio session: \(error.localizedDescription)")
        }
    }
}
