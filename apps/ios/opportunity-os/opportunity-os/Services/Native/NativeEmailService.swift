import Foundation
import MessageUI

/// Determines whether the device can send email via MFMailComposeViewController.
/// Returns false on Simulator since Mail accounts are not configured there.
func canSendMailNatively() -> Bool {
    MFMailComposeViewController.canSendMail()
}

/// Builds a mailto: URL as a fallback for Simulator / devices without Mail configured.
func mailtoURL(for message: OutreachMessage) -> URL? {
    var components = URLComponents()
    components.scheme = "mailto"
    components.path = message.recipients.compactMap(\.email).joined(separator: ",")

    var queryItems: [URLQueryItem] = []
    queryItems.append(URLQueryItem(name: "subject", value: message.subject))
    queryItems.append(URLQueryItem(name: "body", value: message.body))
    components.queryItems = queryItems

    return components.url
}
