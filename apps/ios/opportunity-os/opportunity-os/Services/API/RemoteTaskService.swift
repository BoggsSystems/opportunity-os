import Foundation

// MARK: - Request/Response

struct CreateTaskRequest: Codable {
    let title: String
    let description: String?
    let dueAt: String?
    let status: String
    let priority: String
    let taskType: String?
    let opportunityId: String?
}

// MARK: - Remote Implementation

final class RemoteTaskService: TaskServiceProtocol {
    private let client: OpportunityOSAPIClient
    private let sessionManager: SessionManager

    init(client: OpportunityOSAPIClient, sessionManager: SessionManager) {
        self.client = client
        self.sessionManager = sessionManager
    }

    func createFollowUpTask(title: String, opportunityId: String?, daysFromNow: Int) async throws -> CreatedTask {
        guard await sessionManager.isAuthenticated else {
            // Return a local stub for guest users — can't persist without a user
            return CreatedTask(id: UUID().uuidString, title: title, dueAt: nil)
        }

        let dueDate = Calendar.current.date(byAdding: .day, value: daysFromNow, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()

        let body = CreateTaskRequest(
            title: title,
            description: "Follow up on outreach email",
            dueAt: formatter.string(from: dueDate),
            status: "open",
            priority: "medium",
            taskType: "follow_up",
            opportunityId: opportunityId
        )

        return try await client.post("tasks", body: body)
    }
}

// MARK: - No-op stub

final class StubTaskService: TaskServiceProtocol {
    func createFollowUpTask(title: String, opportunityId: String?, daysFromNow: Int) async throws -> CreatedTask {
        CreatedTask(id: UUID().uuidString, title: title, dueAt: nil)
    }
}
