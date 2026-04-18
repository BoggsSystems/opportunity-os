import Foundation

@inline(__always)
func debugTrace(_ category: String, _ message: @autoclosure () -> String) {
    #if DEBUG
    let timestamp = ISO8601DateFormatter().string(from: Date())
    print("[\(timestamp)] [\(category)] \(message())")
    #endif
}
