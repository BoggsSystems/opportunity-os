import Foundation

// Global reference to remote debug service - set during app initialization
var sharedRemoteDebugService: RemoteDebugServiceProtocol?

@inline(__always)
func debugTrace(_ category: String, _ message: @autoclosure () -> String) {
    #if DEBUG
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let logMessage = "[\(timestamp)] [\(category)] \(message())"
    print(logMessage)
    
    // Also send to backend for centralized logging
    sharedRemoteDebugService?.log(logMessage, level: "DEBUG")
    #endif
}
