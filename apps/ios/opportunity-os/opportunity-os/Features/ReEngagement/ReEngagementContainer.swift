import SwiftUI

/// Container that manages re-engagement lifecycle and presents content over the main app
struct ReEngagementContainer<Content: View>: View {
    @StateObject private var viewModel: ReEngagementViewModel
    @Environment(\.scenePhase) private var scenePhase
    let content: Content
    let onNavigate: (ReEngagementAction) -> Void
    
    init(
        briefingService: ReEngagementBriefingService,
        speechSynthesisService: SpeechSynthesisServiceProtocol? = nil,
        sessionManager: SessionManager? = nil,
        onBriefingGenerated: ((String) -> Void)? = nil,
        onNavigate: @escaping (ReEngagementAction) -> Void,
        @ViewBuilder content: () -> Content
    ) {
        let vm = ReEngagementViewModel(
            briefingService: briefingService,
            speechSynthesisService: speechSynthesisService,
            sessionManager: sessionManager
        )
        vm.onBriefingGenerated = onBriefingGenerated
        self._viewModel = StateObject(wrappedValue: vm)
        self.onNavigate = onNavigate
        self.content = content()
    }
    
    var body: some View {
        ZStack(alignment: .top) {
            // Main app content
            content
            
            // Re-engagement overlay (if any)
            if viewModel.currentTier.isShowingBriefing {
                // Semi-transparent backdrop for higher tiers
                if shouldShowBackdrop {
                    Color.black
                        .opacity(0.15)
                        .ignoresSafeArea()
                        .onTapGesture {
                            viewModel.dismissCurrentBriefing()
                        }
                        .transition(.opacity)
                }
                
                ReEngagementView(
                    viewModel: viewModel,
                    onAction: onNavigate
                )
                .zIndex(100)
            }
        }
        .onChange(of: scenePhase) { newPhase, _ in
            handleScenePhaseChange(newPhase)
        }
    }
    
    private var shouldShowBackdrop: Bool {
        switch viewModel.currentTier {
        case .showingMorningBriefing, .showingReengagementBriefing:
            return true
        default:
            return false
        }
    }
    
    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        Task {
            switch newPhase {
            case .active:
                await viewModel.handleAppBecameActive()
            case .inactive, .background:
                viewModel.handleAppBecameInactive()
            @unknown default:
                break
            }
        }
    }
}

// MARK: - Scene Phase Environment

/// Helper view modifier to track scene phase changes
struct ReEngagementScenePhaseModifier: ViewModifier {
    @Binding var phase: ScenePhase
    
    func body(content: Content) -> some View {
        content
            .onChange(of: phase) { _ in }
            .environment(\.scenePhase, phase)
    }
}

// MARK: - View Extension

extension View {
    /// Wraps the view with re-engagement container functionality
    func withReEngagement(
        briefingService: ReEngagementBriefingService,
        speechSynthesisService: SpeechSynthesisServiceProtocol? = nil,
        sessionManager: SessionManager? = nil,
        onBriefingGenerated: ((String) -> Void)? = nil,
        onNavigate: @escaping (ReEngagementAction) -> Void
    ) -> some View {
        ReEngagementContainer(
            briefingService: briefingService,
            speechSynthesisService: speechSynthesisService,
            sessionManager: sessionManager,
            onBriefingGenerated: onBriefingGenerated,
            onNavigate: onNavigate
        ) {
            self
        }
    }
}
