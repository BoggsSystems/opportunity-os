import Foundation

struct User: Identifiable, Hashable, Codable {
    let id: UUID
    var firstName: String
    var lastName: String
    var email: String
    var preferredInteractionMode: InteractionMode
}

struct AuthSession: Hashable, Codable {
    let accessToken: String
    let refreshToken: String?
    let sessionId: String?
    let user: User
    let startedAt: Date
}

enum AuthEntryMode: String, Codable, Hashable {
    case signUp
    case signIn

    var title: String {
        switch self {
        case .signUp: "Create your account"
        case .signIn: "Welcome back"
        }
    }

    var emailPrompt: String {
        switch self {
        case .signUp: "Use your work email to set up Opportunity OS."
        case .signIn: "Sign in with the email tied to your outreach workflow."
        }
    }

    var passwordPrompt: String {
        switch self {
        case .signUp: "Create a secure password for future sessions."
        case .signIn: "Enter your password to continue where you left off."
        }
    }

    var primaryActionTitle: String {
        switch self {
        case .signUp: "Create Account"
        case .signIn: "Sign In"
        }
    }
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
    var lifecycleStatus: String?
    var fitScore: Int?
    var priorityScore: Int?
}

struct ContentUploadResult: Hashable {
    var discoveredItemId: UUID?
    var contentOpportunityId: UUID?
    var title: String
    var source: String?
    var summary: String?
    var processingStatus: String
}

struct ExecutedTarget: Identifiable, Hashable {
    let id: UUID
    var fullName: String
    var companyName: String
    var reasonForOutreach: String
    var suggestedAngle: String
    var opportunityId: UUID
}

struct ContentExecutionResult: Hashable {
    var contentOpportunityId: UUID?
    var discoveredItemId: UUID?
    var targetCount: Int
    var targets: [ExecutedTarget]
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

struct NextAction: Hashable {
    var title: String
    var reason: String
    var recommendedAction: String
    var opportunityId: UUID?
}

struct AssistantConversationMessage: Hashable {
    enum Role: String, Hashable {
        case system
        case user
        case assistant
    }

    var role: Role
    var text: String
}

struct AssistantConversationContext: Hashable {
    var workspaceState: String
    var nextAction: NextAction?
    var opportunity: Opportunity?
    var contentItem: ContentItem?
}

struct AssistantConversationReply: Hashable {
    var sessionId: String?
    var text: String
    var shouldBeSilent: Bool = false
}

struct AssistantConversationStreamChunk: Hashable {
    enum Kind: Hashable {
        case session
        case textDelta
        case done
    }

    var kind: Kind
    var sessionId: String?
    var text: String?
    var fullReply: String?
    var shouldBeSilent: Bool = false
}

enum AppRouteState: Hashable {
    case onboarding
    case main
}

struct OnboardingPlan: Hashable {
    var focusArea: String
    var opportunityType: String
    var targetAudience: String
    var firstCycleTitle: String
    var assistantSummary: String
    var confirmationMessage: String
    var firstCycleSteps: [String]
    var firstDraftPrompt: String
}

struct SessionMessage: Identifiable, Hashable {
    enum Role: Hashable {
        case assistant
        case user
    }

    let id: UUID
    let role: Role
    var text: String

    init(id: UUID = UUID(), role: Role, text: String) {
        self.id = id
        self.role = role
        self.text = text
    }
}

struct UserAsset: Identifiable, Hashable, Codable {
    let id: UUID
    var displayName: String
    var fileName: String
    var fileUrl: String
    var category: AssetCategory
    var isDefault: Bool
    var narrative: AssetNarrative?
}

enum AssetCategory: String, CaseIterable, Codable, Hashable {
    case resume
    case executiveBrief = "executive_brief"
    case portfolio
    case book
    case presentation
    case other
    
    var displayName: String {
        switch self {
        case .resume: "Resume"
        case .executiveBrief: "Executive Brief"
        case .portfolio: "Portfolio"
        case .book: "Book"
        case .presentation: "Presentation"
        case .other: "Other"
        }
    }
}

struct AssetNarrative: Hashable, Codable {
    var valueProposition: String?
    var targetPersona: String?
    var keyProofPoints: [String]?
    var aiToneDNA: [String]?
}

enum VoiceConversationState: Hashable {
    case ready
    case listening
    case thinking
    case speaking
}

enum SessionWorkspaceState: Hashable {
    case nextAction
    case discovery(ContentItem)
    case drafting(Opportunity)
    case draftReady(OutreachMessage)
    case completion(title: String, detail: String)
    case empty
}
