import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.97, green: 0.98, blue: 1.00)
    static let secondaryBackground = Color(red: 0.93, green: 0.95, blue: 0.98)
    static let surface = Color.white
    static let card = Color.white
    static let border = Color(red: 0.86, green: 0.89, blue: 0.94)
    static let accent = Color(red: 0.00, green: 0.34, blue: 0.91)
    static let accentSoft = Color(red: 0.90, green: 0.95, blue: 1.00)
    static let orbPrimary = Color(red: 0.12, green: 0.49, blue: 0.99)
    static let orbSecondary = Color(red: 0.47, green: 0.73, blue: 1.00)
    static let primaryText = Color(red: 0.08, green: 0.12, blue: 0.18)
    static let mutedText = Color(red: 0.41, green: 0.47, blue: 0.56)
    static let shadow = Color.black.opacity(0.08)
    static let success = Color(red: 0.10, green: 0.62, blue: 0.41)

    static let pageBackground = LinearGradient(
        colors: [Color.white, secondaryBackground],
        startPoint: .top,
        endPoint: .bottom
    )
}
