import Foundation

enum APIConfiguration {
    private static let simulatorBaseURL = "http://127.0.0.1:3001"
    private static let deviceBaseURL = "http://Jeffs-MacBook-Air.local:3001"

    static let baseURL: URL = {
        if let override = ProcessInfo.processInfo.environment["OPPORTUNITY_OS_API_BASE_URL"],
           let url = URL(string: override) {
            return url
        }

        #if targetEnvironment(simulator)
        return URL(string: simulatorBaseURL)!
        #else
        return URL(string: deviceBaseURL)!
        #endif
    }()

    static var debugBaseURLString: String {
        baseURL.absoluteString
    }

    static var debugEnvironmentLabel: String {
        #if targetEnvironment(simulator)
        return "Simulator"
        #else
        return "Device"
        #endif
    }
}

enum APIClientError: LocalizedError {
    case invalidResponse
    case server(message: String)
    case transport(message: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .server(let message):
            return message
        case .transport(let message):
            return message
        }
    }
}

struct OpportunityOSAPIClient {
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    func post<Response: Decodable>(_ path: String, body: some Encodable, accessToken: String? = nil) async throws -> Response {
        let request = try makeJSONRequest(path: path, method: "POST", body: body, accessToken: accessToken)
        debugTrace("APIClient", "POST \(path) starting url=\(request.url?.absoluteString ?? "nil"), hasAuth=\(accessToken != nil)")

        let (data, response) = try await executeDataRequest(request)
        if let httpResponse = response as? HTTPURLResponse {
            debugTrace("APIClient", "POST \(path) completed status=\(httpResponse.statusCode), bytes=\(data.count)")
            if let bodyString = String(data: data, encoding: .utf8) {
                debugTrace("APIClient", "RAW RESPONSE BODY: \(bodyString)")
            }
        }
        return try decodeResponse(data: data, response: response)
    }

    func get<Response: Decodable>(_ path: String, accessToken: String? = nil) async throws -> Response {
        var request = URLRequest(url: APIConfiguration.baseURL.appendingPathComponent(path))
        request.httpMethod = "GET"
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        debugTrace("APIClient", "GET \(path) starting url=\(request.url?.absoluteString ?? "nil"), hasAuth=\(accessToken != nil)")

        let (data, response) = try await executeDataRequest(request)
        if let httpResponse = response as? HTTPURLResponse {
            debugTrace("APIClient", "GET \(path) completed status=\(httpResponse.statusCode), bytes=\(data.count)")
        }
        return try decodeResponse(data: data, response: response)
    }

    func postMultipart<Response: Decodable>(
        _ path: String,
        fields: [String: String],
        fileFieldName: String,
        fileName: String,
        mimeType: String,
        fileData: Data,
        accessToken: String? = nil
    ) async throws -> Response {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: APIConfiguration.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        for (name, value) in fields {
            body.appendString("--\(boundary)\r\n")
            body.appendString("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            body.appendString("\(value)\r\n")
        }

        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(fileFieldName)\"; filename=\"\(fileName)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.appendString("\r\n")
        body.appendString("--\(boundary)--\r\n")
        request.httpBody = body
        debugTrace(
            "APIClient",
            "POST multipart \(path) starting url=\(request.url?.absoluteString ?? "nil"), fieldCount=\(fields.count), fileName=\(fileName), bytes=\(fileData.count), hasAuth=\(accessToken != nil)"
        )

        let (data, response) = try await executeDataRequest(request)
        if let httpResponse = response as? HTTPURLResponse {
            debugTrace("APIClient", "POST multipart \(path) completed status=\(httpResponse.statusCode), bytes=\(data.count)")
        }
        return try decodeResponse(data: data, response: response)
    }

    func postNDJSONStream<Response: Decodable>(
        _ path: String,
        body: some Encodable,
        accessToken: String? = nil
    ) throws -> AsyncThrowingStream<Response, Error> {
        let request = try makeJSONRequest(path: path, method: "POST", body: body, accessToken: accessToken)
        debugTrace("APIClient", "POST stream \(path) starting url=\(request.url?.absoluteString ?? "nil"), hasAuth=\(accessToken != nil)")

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let (bytes, response) = try await executeByteRequest(request)
                    try validateResponse(response)
                    if let httpResponse = response as? HTTPURLResponse {
                        debugTrace("APIClient", "POST stream \(path) connected status=\(httpResponse.statusCode)")
                    }

                    for try await line in bytes.lines {
                        guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
                        debugTrace("APIClient", "POST stream \(path) line=\(line.prefix(200))")
                        let lineData = Data(line.utf8)
                        let item: Response
                        do {
                            item = try decoder.decode(Response.self, from: lineData)
                        } catch {
                            debugTrace("APIClient", "POST stream \(path) decode failed error=\(error.localizedDescription)")
                            throw error
                        }
                        continuation.yield(item)
                    }

                    debugTrace("APIClient", "POST stream \(path) finished")
                    continuation.finish()
                } catch {
                    debugTrace("APIClient", "POST stream \(path) failed error=\(error.localizedDescription)")
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func makeJSONRequest(
        path: String,
        method: String,
        body: some Encodable,
        accessToken: String?
    ) throws -> URLRequest {
        var request = URLRequest(url: APIConfiguration.baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try encoder.encode(AnyEncodable(body))
        return request
    }

    private func executeDataRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            debugTrace("APIClient", "data request failed url=\(request.url?.absoluteString ?? "nil"), error=\(error.localizedDescription)")
            throw mapTransportError(error, url: request.url)
        }
    }

    private func executeByteRequest(_ request: URLRequest) async throws -> (URLSession.AsyncBytes, URLResponse) {
        do {
            return try await session.bytes(for: request)
        } catch {
            debugTrace("APIClient", "byte request failed url=\(request.url?.absoluteString ?? "nil"), error=\(error.localizedDescription)")
            throw mapTransportError(error, url: request.url)
        }
    }

    private func decodeResponse<Response: Decodable>(data: Data, response: URLResponse) throws -> Response {
        try validateResponse(response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func validateResponse(_ response: URLResponse, data: Data? = nil) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            debugTrace("APIClient", "received non-HTTP response")
            throw APIClientError.invalidResponse
        }

        if (200 ... 299).contains(httpResponse.statusCode) {
            return
        }

        debugTrace("APIClient", "response validation failed status=\(httpResponse.statusCode), bodyBytes=\(data?.count ?? 0)")

        if let data, let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
            throw APIClientError.server(message: errorResponse.message)
        }

        throw APIClientError.server(message: "The request failed with status code \(httpResponse.statusCode).")
    }

    private func mapTransportError(_ error: Error, url: URL?) -> APIClientError {
        let host = url?.host ?? APIConfiguration.baseURL.host ?? APIConfiguration.debugBaseURLString

        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotFindHost, .dnsLookupFailed:
                return .transport(message: "Cannot find the backend host '\(host)'. Make sure your phone and Mac are on the same Wi‑Fi and the Mac is reachable on the local network.")
            case .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet:
                return .transport(message: "Cannot connect to the backend at \(APIConfiguration.debugBaseURLString). Check that the API is running on your Mac and local network access is allowed.")
            case .timedOut:
                return .transport(message: "The request to \(APIConfiguration.debugBaseURLString) timed out. The backend may be down or unreachable from this device.")
            case .appTransportSecurityRequiresSecureConnection:
                return .transport(message: "iOS blocked the connection to \(APIConfiguration.debugBaseURLString). App Transport Security is preventing the request.")
            default:
                return .transport(message: "Network error while connecting to \(APIConfiguration.debugBaseURLString): \(urlError.localizedDescription)")
            }
        }

        return .transport(message: "Unexpected connection error while contacting \(APIConfiguration.debugBaseURLString): \(error.localizedDescription)")
    }
}

private extension Data {
    mutating func appendString(_ value: String) {
        append(Data(value.utf8))
    }
}

struct RemoteAuthService: AuthServiceProtocol {
    private let client: OpportunityOSAPIClient

    init(client: OpportunityOSAPIClient) {
        self.client = client
    }

    func signUp(email: String, password: String) async throws -> AuthSession {
        debugTrace("RemoteAuth", "sign up requested email=\(email)")
        let response: AuthResponse = try await client.post(
            "auth/signup",
            body: SignUpRequest(email: email, password: password, fullName: nil, timezone: TimeZone.current.identifier)
        )
        return response.authSession
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        debugTrace("RemoteAuth", "sign in requested email=\(email) via \(APIConfiguration.debugEnvironmentLabel) -> \(APIConfiguration.debugBaseURLString)")
        let response: AuthResponse = try await client.post(
            "auth/login",
            body: LoginRequest(email: email, password: password)
        )
        return response.authSession
    }

    func signOut(accessToken: String?) async {
        guard let accessToken else {
            return
        }

        do {
            let _: LogoutResponse = try await client.post("auth/logout", body: EmptyRequest(), accessToken: accessToken)
        } catch {
            debugTrace("RemoteAuth", "sign out failed error=\(error.localizedDescription)")
        }
    }
}

private struct AuthResponse: Decodable {
    let user: APIUser
    let accessToken: String
    let refreshToken: String?
    let session: APISession

    var authSession: AuthSession {
        AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            sessionId: session.id,
            user: user.domainUser,
            startedAt: Date()
        )
    }
}

private struct APIUser: Decodable {
    let id: String
    let email: String
    let fullName: String?
}

private extension APIUser {
    var domainUser: User {
        let components = (fullName ?? "")
            .split(separator: " ", maxSplits: 1)
            .map(String.init)

        let firstName = components.first?.isEmpty == false ? components[0] : "Opportunity"
        let lastName = components.count > 1 ? components[1] : "User"

        return User(
            id: UUID(uuidString: id) ?? UUID(),
            firstName: firstName,
            lastName: lastName,
            email: email,
            preferredInteractionMode: .voiceFirst
        )
    }
}

private struct APISession: Decodable {
    let id: String
}

private struct APIErrorResponse: Decodable {
    let message: String
}

private struct SignUpRequest: Encodable {
    let email: String
    let password: String
    let fullName: String?
    let timezone: String
}

private struct LoginRequest: Encodable {
    let email: String
    let password: String
}

private struct LogoutResponse: Decodable {
    let success: Bool
}

private struct EmptyRequest: Encodable {}

private struct AnyEncodable: Encodable {
    private let encodeImpl: (Encoder) throws -> Void

    init(_ wrapped: some Encodable) {
        self.encodeImpl = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeImpl(encoder)
    }
}
