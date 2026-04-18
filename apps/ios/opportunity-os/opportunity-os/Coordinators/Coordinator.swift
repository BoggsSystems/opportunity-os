import SwiftUI

protocol Coordinator: ObservableObject {
    associatedtype CoordinatorView: View
    @ViewBuilder func view() -> CoordinatorView
}
