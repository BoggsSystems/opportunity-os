import Foundation

protocol RemoteDebugServiceProtocol {
    func log(_ message: String, level: String)
}

extension RemoteDebugServiceProtocol {
    func log(_ message: String, level: String = "DEBUG") {
        log(message, level: level)
    }
}

struct RemoteDebugService: RemoteDebugServiceProtocol {
    private let client: OpportunityOSAPIClient
    
    init(client: OpportunityOSAPIClient) {
        self.client = client
    }
    
    func log(_ message: String, level: String = "DEBUG") {
        print("LOCAL_DEBUG: \(message)") // Keep local print
        
        Task {
            do {
                struct DebugLogBody: Encodable {
                    let message: String
                    let level: String
                }
                
                let _ = try await client.post(
                    "ai/debug-logs",
                    body: DebugLogBody(message: message, level: level),
                    accessToken: nil
                ) as [String: AnyCodable]
            } catch {
                print("Failed to send remote log: \(error)")
            }
        }
    }
}

// Helper for AnyCodable if needed, or just use a simpler way
private struct AnyCodable: Decodable {}
