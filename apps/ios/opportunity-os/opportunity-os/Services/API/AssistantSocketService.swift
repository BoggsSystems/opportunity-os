import Foundation
import Combine
import os

/// Service that manages the persistent WebSocket connection for the Assistant.
/// This implementation uses a "Dual-Track" approach: 
/// 1. Binary Track: Low-latency audio chunks for speech synthesis.
/// 2. Event Track: JSON messages for UI state, navigation, and strategic plans.
class AssistantSocketService: NSObject, ObservableObject {
    enum SocketState: Equatable {
        case disconnected
        case connecting
        case connected
        case error(String)
    }
    
    @Published var state: SocketState = .disconnected
    
    // Publishers for the two tracks
    let audioPublisher = PassthroughSubject<Data, Never>()
    let eventPublisher = PassthroughSubject<AssistantEvent, Never>()
    let textPublisher = PassthroughSubject<String, Never>()
    
    private var webSocketTask: URLSessionWebSocketTask?
    private let url: URL
    private let logger = Logger(subsystem: "com.opportunity-os", category: "AssistantSocket")
    
    init(url: URL) {
        self.url = url
    }
    
    func connect() {
        let isError: Bool
        if case .error = state { isError = true } else { isError = false }
        
        guard state == .disconnected || isError else { return }
        
        state = .connecting
        logger.info("Assistant Socket Handshake Started to URL: \(self.url.absoluteString)")
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        webSocketTask = session.webSocketTask(with: self.url)
        webSocketTask?.resume()
        
        listen()
        // state = .connected (MOVED TO DELEGATE)
        logger.info("Assistant Socket Handshake Task Resumed")
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        state = .disconnected
        logger.info("Assistant Socket Disconnected")
    }
    
    /// Sends a conversational message to the assistant
    func converse(
        message: String,
        sessionId: String?,
        guestSessionId: String?,
        history: [AssistantConversationMessage]?,
        context: AssistantConversationContext?,
        userId: String?
    ) {
        print("🔍 WS ATTEMPT CONVERSE: state=\(state), url=\(self.url.absoluteString)")
        
        guard state == .connected else {
            logger.error("Attempted converse while socket is \(String(describing: self.state))")
            return
        }
        let data: [String: Any?] = [
            "message": message,
            "sessionId": sessionId,
            "guestSessionId": guestSessionId,
            "history": history,
            "context": context,
            "userId": userId
        ]
        
        let payload: [String: Any] = [
            "event": "converse",
            "data": data
        ]
        
        // Use a more robust serialization approach
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            
            // We wrap in a Codable struct for easier encoding
            struct ConverseWrapper: Codable {
                let event: String
                let data: ConverseData
            }
            struct ConverseData: Codable {
                let message: String
                let sessionId: String?
                let guestSessionId: String?
                let history: [AssistantConversationMessage]?
                let context: AssistantConversationContext?
                let userId: String?
            }
            
            let wrapper = ConverseWrapper(
                event: "converse",
                data: ConverseData(
                    message: message,
                    sessionId: sessionId,
                    guestSessionId: guestSessionId,
                    history: history,
                    context: context,
                    userId: userId
                )
            )
            
            let jsonData = try encoder.encode(wrapper)
            guard let jsonString = String(data: jsonData, encoding: .utf8) else {
                logger.error("Failed to convert JSON data to string")
                return
            }
            
            print("📤 WS SENDING PAYLOAD: \(jsonString)")
            let message = URLSessionWebSocketTask.Message.string(jsonString)
            
            webSocketTask?.send(message) { error in
                if let error = error {
                    self.logger.error("Failed to send message: \(error.localizedDescription)")
                }
            }
        } catch {
            logger.error("Failed to encode converse payload: \(error.localizedDescription)")
        }
    }
    
    private func listen() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    // TRACK 1: BINARY AUDIO
                    self.audioPublisher.send(data)
                    
                case .string(let string):
                    // TRACK 2: JSON EVENTS
                    self.handleJsonMessage(string)
                    
                @unknown default:
                    break
                }
                
                // Continue listening
                self.listen()
                
            case .failure(let error):
                self.logger.error("Socket error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self.state = .error(error.localizedDescription)
                }
            }
        }
    }
    
    private func handleJsonMessage(_ string: String) {
        guard let data = string.data(using: .utf8) else { return }
        
        do {
            let decoder = JSONDecoder()
            let rawEvent = try decoder.decode(RawAssistantEvent.self, from: data)
            
            switch rawEvent.type {
            case "text_chunk":
                if let text = rawEvent.text {
                    textPublisher.send(text)
                }
            case "ui_event":
                if let eventName = rawEvent.event {
                    eventPublisher.send(.uiSignal(eventName))
                }
            case "converse_done":
                eventPublisher.send(.done(
                    reply: rawEvent.reply ?? "",
                    action: rawEvent.suggestedAction,
                    plan: rawEvent.strategicPlan
                ))
            case "session_started":
                if let sid = rawEvent.sessionId {
                    eventPublisher.send(.sessionStarted(sid))
                }
            default:
                break
            }
        } catch {
            logger.error("Failed to decode event: \(string)")
            // Pipe this to the backend so we can see it during testing
            debugTrace("AssistantSocket", "❌ DECODE FAILURE: \(error.localizedDescription) | RAW: \(string)")
        }
    }
}

// MARK: - Delegate

extension AssistantSocketService: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol `protocol`: String?) {
        self.logger.info("Assistant Socket Connected (Verified)")
        DispatchQueue.main.async {
            self.state = .connected
        }
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        self.logger.info("Assistant Socket Closed")
        DispatchQueue.main.async {
            self.state = .disconnected
        }
    }
}

// MARK: - Event Models

enum AssistantEvent {
    case sessionStarted(String)
    case uiSignal(String)
    case done(reply: String, action: String?, plan: StrategicPlan?)
}

struct RawAssistantEvent: Codable {
    let type: String
    let sessionId: String?
    let text: String?
    let event: String?
    let reply: String?
    let suggestedAction: String?
    let strategicPlan: StrategicPlan?
}
