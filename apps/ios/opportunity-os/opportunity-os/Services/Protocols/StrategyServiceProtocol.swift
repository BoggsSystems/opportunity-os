import Foundation

/// Protocol for onboarding finalization service
protocol StrategyServiceProtocol {
    /// Finalizes onboarding by extracting goal from conversation via backend AI
    /// - Parameters:
    ///   - sessionId: The conversation session ID
    /// - Returns: The persisted onboarding result with goal and campaign
    func finalizeStrategicGoal(sessionId: String) async throws -> StrategicResult
    
    /// Extracts the onboarding plan without persisting (Preview Mode)
    func previewStrategicPlan(sessionId: String) async throws -> StrategicResult
}

/// Result from finalizing onboarding
struct StrategicResult: Codable {
    let success: Bool
    let goal: PersistedGoal
    let campaign: PersistedCampaign
    let extractedIntent: ExtractedIntent
    let timestamp: String
    
    /// Converts to StrategicPlan for UI consumption
    func toStrategicPlan() -> StrategicPlan {
        StrategicPlan(
            focusArea: extractedIntent.focusArea,
            opportunityType: extractedIntent.opportunityType,
            targetAudience: extractedIntent.targetAudience,
            firstCycleTitle: extractedIntent.firstCycleTitle,
            assistantSummary: "Your goal: \(goal.title)",
            confirmationMessage: extractedIntent.firstCycleSteps.first ?? "Let's get started",
            firstCycleSteps: extractedIntent.firstCycleSteps,
            firstDraftPrompt: extractedIntent.firstDraftPrompt
        )
    }
}

struct PersistedGoal: Codable {
    let id: String
    let title: String
    let description: String?
    let status: String
}

struct PersistedCampaign: Codable {
    let id: String
    let title: String
    let strategicAngle: String?
    let targetSegment: String?
    let status: String
}

struct ExtractedIntent: Codable {
    let focusArea: String
    let opportunityType: String
    let targetAudience: String
    let firstCycleTitle: String
    let firstCycleSteps: [String]
    let firstDraftPrompt: String
}

enum OnboardingError: Error {
    case noSessionId
    case invalidResponse
    case serverError(String)
}
