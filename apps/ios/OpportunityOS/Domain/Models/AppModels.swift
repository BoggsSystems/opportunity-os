import Foundation

struct User: Identifiable, Hashable {
    let id: UUID
    var firstName: String
    var lastName: String
    var email: String
    var preferredInteractionMode: InteractionMode
}

struct AuthSession: Hashable {
    let token: String
    let user: User
    let startedAt: Date
}

enum InteractionMode: String, CaseIterable, Codable, Hashable {
    case voiceFirst
    case touchFirst

    var title: String {
        switch self {
        case .voiceFirst: "Voice First"
        case .touchFirst: "Touch First"
        }
    }
}

struct VoicePreference: Hashable {
    var styleDescription: String
    var localeIdentifier: String
    var displayName: String
    var speakingRate: Double
    var prefersVoiceInput: Bool
}

struct Opportunity: Identifiable, Hashable {
    let id: UUID
    var title: String
    var companyName: String
    var summary: String
    var type: OpportunityType
    var source: OpportunitySource
    var cycleStatus: CycleStatus
    var momentumScore: Int
    var recipients: [Recipient]
}

enum OpportunityType: String, CaseIterable, Codable, Hashable {
    case outreach
    case followUp
    case contentDriven
    case partnership
}

enum OpportunitySource: String, CaseIterable, Codable, Hashable {
    case scan
    case aiDiscovery
    case campaign
    case manual
}

struct ContentItem: Identifiable, Hashable {
    let id: UUID
    var title: String
    var source: String
    var summary: String
    var linkedOfferingName: String?
    var campaignPotential: String
}

struct Campaign: Identifiable, Hashable {
    let id: UUID
    var title: String
    var theme: String
    var status: CycleStatus
    var linkedContentItems: [ContentItem]
}

struct OutreachMessage: Identifiable, Hashable {
    let id: UUID
    var subject: String
    var body: String
    var recipients: [Recipient]
    var approvalRequired: Bool
}

struct Recipient: Identifiable, Hashable {
    let id: UUID
    var name: String
    var organization: String
    var email: String?
    var role: String
}

struct FollowUpItem: Identifiable, Hashable {
    let id: UUID
    var title: String
    var reason: String
    var dueDate: Date
    var recipient: Recipient
}

struct Cycle: Identifiable, Hashable {
    let id: UUID
    var title: String
    var currentStep: CycleStep
    var status: CycleStatus
    var progress: Double
    var recommendedPrompt: String
}

enum CycleStep: String, CaseIterable, Codable, Hashable {
    case scan
    case qualify
    case draft
    case review
    case send
    case reflect
}

enum CycleStatus: String, CaseIterable, Codable, Hashable {
    case idle
    case ready
    case inProgress
    case waiting
    case completed
}

struct ProductOrService: Identifiable, Hashable {
    let id: UUID
    var name: String
    var positioning: String
}

struct ScanResult: Identifiable, Hashable {
    let id: UUID
    var title: String
    var summary: String
    var source: OpportunitySource
    var suggestedAction: String
}

enum AppRouteState: Hashable {
    case onboarding
    case main
}
