import Foundation

struct StubOnboardingService: OnboardingServiceProtocol {
    func finalizeOnboarding(sessionId: String) async throws -> OnboardingResult {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        return OnboardingResult(
            success: true,
            goal: PersistedGoal(
                id: UUID().uuidString,
                title: "Professional Outreach Goal",
                description: "Build meaningful connections",
                status: "active"
            ),
            campaign: PersistedCampaign(
                id: UUID().uuidString,
                title: "Initial Outreach Campaign",
                strategicAngle: "Value-first messaging",
                targetSegment: "Relevant professionals",
                status: "planning"
            ),
            extractedIntent: ExtractedIntent(
                focusArea: "general",
                opportunityType: "outreach",
                targetAudience: "relevant professionals",
                firstCycleTitle: "First cycle: Initial outreach",
                firstCycleSteps: ["Confirm your offer", "Pick first targets", "Draft your message"],
                firstDraftPrompt: "Draft a first outreach message for relevant professionals."
            ),
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
    }
}
