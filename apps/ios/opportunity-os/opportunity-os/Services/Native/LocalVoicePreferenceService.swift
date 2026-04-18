import Foundation

actor LocalVoicePreferenceStore {
    private enum StorageKeys {
        static let voicePreference = "opportunity_os.voice_preference"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> VoicePreference {
        guard
            let data = defaults.data(forKey: StorageKeys.voicePreference),
            let preference = try? JSONDecoder().decode(CodableVoicePreference.self, from: data)
        else {
            return PreviewData.voicePreference
        }

        return preference.domainPreference
    }

    func save(_ preference: VoicePreference) {
        let codable = CodableVoicePreference(preference: preference)
        if let data = try? JSONEncoder().encode(codable) {
            defaults.set(data, forKey: StorageKeys.voicePreference)
        }
    }
}

struct LocalVoicePreferenceService: VoicePreferenceServiceProtocol {
    private let store: LocalVoicePreferenceStore

    init(defaults: UserDefaults = .standard) {
        self.store = LocalVoicePreferenceStore(defaults: defaults)
    }

    func loadPreference() async -> VoicePreference {
        await store.load()
    }

    func savePreference(_ preference: VoicePreference) async {
        await store.save(preference)
    }

    func parseNaturalLanguageVoiceRequest(_ request: String, current: VoicePreference) async -> VoicePreference {
        var updated = current
        let lowercased = request.lowercased()

        if lowercased.contains("british") {
            updated.localeIdentifier = "en-GB"
        } else if lowercased.contains("american") || lowercased.contains("us") {
            updated.localeIdentifier = "en-US"
        } else if lowercased.contains("canadian") {
            updated.localeIdentifier = "en-CA"
        }

        if lowercased.contains("female") || lowercased.contains("woman") {
            updated.displayName = "Avery"
        } else if lowercased.contains("male") || lowercased.contains("man") {
            updated.displayName = "Milo"
        }

        if lowercased.contains("slower") || lowercased.contains("calm") {
            updated.speakingRate = 0.42
        } else if lowercased.contains("faster") || lowercased.contains("quick") {
            updated.speakingRate = 0.56
        }

        updated.styleDescription = request
        return updated
    }
}

private struct CodableVoicePreference: Codable {
    let styleDescription: String
    let localeIdentifier: String
    let displayName: String
    let speakingRate: Double
    let prefersVoiceInput: Bool

    init(preference: VoicePreference) {
        self.styleDescription = preference.styleDescription
        self.localeIdentifier = preference.localeIdentifier
        self.displayName = preference.displayName
        self.speakingRate = preference.speakingRate
        self.prefersVoiceInput = preference.prefersVoiceInput
    }

    var domainPreference: VoicePreference {
        VoicePreference(
            styleDescription: styleDescription,
            localeIdentifier: localeIdentifier,
            displayName: displayName,
            speakingRate: speakingRate,
            prefersVoiceInput: prefersVoiceInput
        )
    }
}
