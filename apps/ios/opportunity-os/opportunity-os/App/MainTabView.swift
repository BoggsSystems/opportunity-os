import SwiftUI

struct MainTabView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    @State private var selectedTab: Tab = .assistant
    @State private var showingAssetVault = false

    enum Tab: String {
        case assistant
        case workspace
        case intelligence
        case profile
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // Tab 1: AI Assistant (Voice & Chat)
            UnifiedAssistantView(viewModel: viewModel)
                .tabItem {
                    Label("Assistant", systemImage: "sparkles")
                }
                .tag(Tab.assistant)

            // Tab 2: Strategic Workspace (Assets, Tables)
            WorkspaceHubView(viewModel: viewModel, showingAssetVault: $showingAssetVault)
                .tabItem {
                    Label("Workspace", systemImage: "square.grid.2x2.fill")
                }
                .tag(Tab.workspace)

            // Tab 3: Intelligence (Analytics)
            AnalyticsPlaceholderView()
                .tabItem {
                    Label("Intelligence", systemImage: "chart.bar.fill")
                }
                .tag(Tab.intelligence)

            // Tab 4: Profile & Settings
            SettingsWorkspaceView(viewModel: viewModel)
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle.fill")
                }
                .tag(Tab.profile)
        }
        .tint(AppTheme.accent)
        .sheet(isPresented: $showingAssetVault) {
            AssetVaultView(apiClient: viewModel.apiClient, sessionManager: viewModel.sessionManager)
        }
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithDefaultBackground()
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}

// MARK: - Workspace Hub (The "Traditional" Side)
struct WorkspaceHubView: View {
    @ObservedObject var viewModel: UnifiedAssistantViewModel
    @Binding var showingAssetVault: Bool
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Strategic Workspace")
                                .font(.title2.weight(.bold))
                            Text("Manage your assets and opportunities")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.mutedText)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)
                    
                    // Quick Action Grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        WorkspaceLinkCard(title: "Asset Vault", icon: "folder.fill", color: .blue) {
                            showingAssetVault = true
                        }
                        WorkspaceLinkCard(title: "Opportunities", icon: "target", color: .orange) {
                            viewModel.workspaceState = .opportunityList
                        }
                        WorkspaceLinkCard(title: "Contacts", icon: "person.2.fill", color: .purple) {
                            // Link to contacts
                        }
                        WorkspaceLinkCard(title: "Action Log", icon: "list.bullet.rectangle.fill", color: .green) {
                            // Link to action log
                        }
                    }
                    .padding(.horizontal)
                    
                    // Contextual Workspace Content
                    VStack(alignment: .leading, spacing: 16) {
                        Text("ACTIVE VIEW")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(AppTheme.mutedText)
                            .padding(.horizontal)
                        
                        DashboardWorkspaceView(viewModel: viewModel)
                            .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(AppTheme.background)
            .navigationBarHidden(true)
        }
    }
}

struct WorkspaceLinkCard: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(color)
                Text(title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.primaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(AppTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
        }
    }
}

struct AnalyticsPlaceholderView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 60))
                .foregroundStyle(AppTheme.accent)
            Text("Intelligence Center")
                .font(.title.weight(.bold))
            Text("Coming soon: Deep analytics on your outreach performance and conversion rates.")
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(AppTheme.mutedText)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.background)
    }
}
