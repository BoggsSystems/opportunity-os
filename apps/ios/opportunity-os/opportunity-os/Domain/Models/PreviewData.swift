import Foundation

enum PreviewData {
    static let user = User(
        id: UUID(),
        firstName: "Jeff",
        lastName: "Boggs",
        email: "jeff@example.com",
        preferredInteractionMode: .voiceFirst
    )

    static let voicePreference = VoicePreference(
        styleDescription: "British female voice with calm pacing",
        localeIdentifier: "en-GB",
        displayName: "Avery",
        speakingRate: 0.47,
        prefersVoiceInput: true
    )

    static let recipients = [
        Recipient(id: UUID(), name: "Nathaniel Barnes", organization: "Hg Capital", email: nil, role: "Portfolio CTO"),
        Recipient(id: UUID(), name: "Serge Haziyev", organization: "SoftServe", email: nil, role: "CTO, Advanced Technologies"),
        Recipient(id: UUID(), name: "Rick Kazman", organization: "University of Hawaii", email: nil, role: "Professor")
    ]

    static let cycle = Cycle(
        id: UUID(),
        title: "Momentum Loop",
        currentStep: .draft,
        status: .inProgress,
        progress: 0.62,
        recommendedPrompt: "I found a report-driven outreach angle. Want to turn it into a campaign?"
    )

    static let opportunities = [
        Opportunity(
            id: UUID(),
            title: "Report-driven outreach to MIT report contributors",
            companyName: "MIT Technology Review network",
            summary: "Turn the agentic software engineering report into a campaign and reach contributors with a relevant perspective.",
            type: .contentDriven,
            source: .aiDiscovery,
            cycleStatus: .ready,
            momentumScore: 91,
            recipients: recipients
        ),
        Opportunity(
            id: UUID(),
            title: "Follow up on AI-native SDLC audit outreach",
            companyName: "SoftServe",
            summary: "Re-engage a previously identified target with a tighter point of view and a new content hook.",
            type: .followUp,
            source: .campaign,
            cycleStatus: .waiting,
            momentumScore: 77,
            recipients: [recipients[1]]
        )
    ]

    static let contentItems = [
        ContentItem(
            id: UUID(),
            title: "Redefining the future of software engineering",
            source: "MIT Technology Review Insights",
            summary: "Agentic AI is shifting software engineering from isolated coding assistance toward broader lifecycle orchestration.",
            linkedOfferingName: "AI-Native SDLC Audit & Transformation",
            campaignPotential: "Use this report as credibility support for outreach and campaign sequencing."
        )
    ]

    static let campaigns: [Campaign] = [
        Campaign(
            id: UUID(),
            goalId: UUID(),
            title: "Agentic Engineering Credibility Campaign",
            strategicAngle: "Use third-party research to open high-signal conversations about AI-native SDLC transformation.",
            targetSegment: "CTOs at mid-market tech companies",
            status: .active,
            assetIds: contentItems.map { $0.id }
        )
    ]

    static let draft = OutreachMessage(
        id: UUID(),
        subject: "Following up on the future of software engineering",
        body: """
        Hi Nathaniel,

        I recently reviewed the MIT Technology Review Insights report on the future of software engineering and thought your perspective stood out. We are helping teams turn the ideas in that report into practical operating changes, especially around AI-native SDLC execution.

        If useful, I can share a concise audit lens we use to identify where agentic workflows create leverage versus noise.

        Best,
        Jeff
        """,
        recipients: [recipients[0]],
        approvalRequired: true
    )
}
