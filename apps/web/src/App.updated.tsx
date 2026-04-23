import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { ApiClient } from './lib/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './store';
import type {
  AuthResponse,
  ConversationMessage,
  OutreachDraft,
  StrategicPlanResult,
  WorkspaceMode,
  WorkspaceSignalSummary,
  WorkspaceState,
} from './types';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

const TEST_PASSWORD = 'Password123!';

// Notification component
const NotificationToast = ({ 
  notification, 
  onClose 
}: { 
  notification: any;
  onClose: (id: string) => void;
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error': return <X className="w-5 h-5 text-red-600" />;
      case 'warning': return <RefreshCw className="w-5 h-5 text-yellow-600" />;
      default: return <Bot className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className={`${getStyles()} border rounded-lg p-4 mb-4 shadow-sm`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{notification.title}</h3>
          <p className="text-sm mt-1">{notification.message}</p>
        </div>
        <button
          onClick={() => onClose(notification.id)}
          className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Main App Component
export function App() {
  const { auth, workspace, subscription, ui } = useStore();
  const api = new ApiClient(auth.accessToken);

  // Initialize app and load data
  useEffect(() => {
    const initializeApp = async () => {
      // Check for existing session
      const storedSession = localStorage.getItem('auth-storage');
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          auth.setAuth(session);
        } catch (error) {
          console.error('Failed to parse stored session:', error);
          auth.clearAuth();
        }
      }

      // Load workspace data if authenticated
      if (auth.isAuthenticated) {
        await loadWorkspaceData();
      }
    };

    initializeApp();
  }, []);

  // Load workspace data
  const loadWorkspaceData = useCallback(async () => {
    if (!auth.isAuthenticated) return;

    auth.setLoading(true);
    try {
      const [workspaceState, subscriptionState, usageState] = await Promise.all([
        api.getWorkspace(),
        api.getSubscription(),
        api.getUsage(),
      ]);

      workspace.setWorkspaceState(workspaceState);
      subscription.setSubscription(subscriptionState);
      subscription.setUsage(usageState);
    } catch (error) {
      ui.addNotification({
        type: 'error',
        title: 'Failed to load workspace',
        message: 'Please refresh the page and try again.',
      });
    } finally {
      auth.setLoading(false);
    }
  }, [auth.isAuthenticated, api, workspace, subscription, ui]);

  // Handle authentication
  const handleLogin = async (email: string, password: string) => {
    auth.setLoading(true);
    try {
      const response = await api.login({ email, password });
      auth.setAuth(response);
      
      ui.addNotification({
        type: 'success',
        title: 'Welcome back!',
        message: `Logged in as ${response.user.fullName || response.user.email}`,
      });

      await loadWorkspaceData();
    } catch (error: any) {
      ui.addNotification({
        type: 'error',
        title: 'Login failed',
        message: error.message || 'Please check your credentials and try again.',
      });
    } finally {
      auth.setLoading(false);
    }
  };

  const handleSignup = async (email: string, password: string, fullName?: string) => {
    auth.setLoading(true);
    try {
      const response = await api.signup({ email, password, fullName });
      auth.setAuth(response);
      
      ui.addNotification({
        type: 'success',
        title: 'Account created!',
        message: 'Welcome to Opportunity OS!',
      });

      await loadWorkspaceData();
    } catch (error: any) {
      ui.addNotification({
        type: 'error',
        title: 'Signup failed',
        message: error.message || 'Please try again with different credentials.',
      });
    } finally {
      auth.setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.clearAuth();
    workspace.clearWorkspace();
    subscription.clearSubscription();
    
    ui.addNotification({
      type: 'info',
      title: 'Logged out',
      message: 'You have been successfully logged out.',
    });
  };

  // Render loading state
  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Opportunity OS...</p>
        </div>
      </div>
    );
  }

  // Render authentication form
  if (!auth.isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Opportunity OS</h1>
                <p className="text-gray-600 mt-2">AI-powered opportunity management</p>
              </div>

              <LoginForm 
                onLogin={handleLogin}
                onSignup={handleSignup}
                isLoading={auth.isLoading}
              />
            </div>
          </div>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }

  // Render main application
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {/* Notifications */}
          <div className="fixed top-4 right-4 z-50 max-w-sm">
            {ui.notifications.map((notification) => (
              <NotificationToast
                key={notification.id}
                notification={notification}
                onClose={ui.removeNotification}
              />
            ))}
          </div>

          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <button
                    onClick={ui.toggleSidebar}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <h1 className="ml-4 text-xl font-semibold text-gray-900">
                    Opportunity OS
                  </h1>
                </div>

                <div className="flex items-center space-x-4">
                  {/* User menu */}
                  <div className="relative">
                    <button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      <UserRound className="w-8 h-8 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <div className="flex">
            {/* Sidebar */}
            <aside className={`${ui.sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white shadow-sm border-r overflow-hidden`}>
              <nav className="p-4 space-y-2">
                <SidebarItem
                  icon={<CircleGauge className="w-5 h-5" />}
                  label="Dashboard"
                  active={workspace.workspaceState?.mode === 'signal_review'}
                />
                <SidebarItem
                  icon={<Target className="w-5 h-5" />}
                  label="Opportunities"
                />
                <SidebarItem
                  icon={<Mail className="w-5 h-5" />}
                  label="Campaigns"
                />
                <SidebarItem
                  icon={<Bot className="w-5 h-5" />}
                  label="AI Assistant"
                />
              </nav>
            </aside>

            {/* Main content area */}
            <main className="flex-1 p-6">
              <ErrorBoundary>
                {workspace.workspaceState ? (
                  <WorkspaceView 
                    workspace={workspace.workspaceState}
                    signals={workspace.signals}
                    onLogout={handleLogout}
                  />
                ) : (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading workspace...</p>
                  </div>
                )}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

// Simple login form component
interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  onSignup: (email: string, password: string, fullName?: string) => void;
  isLoading: boolean;
}

function LoginForm({ onLogin, onSignup, isLoading }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      onLogin(formData.email, formData.password);
    } else {
      onSignup(formData.email, formData.password, formData.fullName);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isLogin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={!isLogin}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {isLogin ? 'Logging in...' : 'Creating account...'}
          </div>
        ) : (
          isLogin ? 'Log In' : 'Sign Up'
        )}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </form>
  );
}

// Sidebar item component
interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
}

// Workspace view component (placeholder)
interface WorkspaceViewProps {
  workspace: WorkspaceState;
  signals: WorkspaceSignalSummary[];
  onLogout: () => void;
}

function WorkspaceView({ workspace, signals, onLogout }: WorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{workspace.signalCount}</div>
            <div className="text-sm text-gray-600">Active Signals</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{workspace.opportunityCount}</div>
            <div className="text-sm text-gray-600">Opportunities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{workspace.goalCount}</div>
            <div className="text-sm text-gray-600">Active Goals</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Signals</h3>
        {signals.length > 0 ? (
          <div className="space-y-3">
            {signals.slice(0, 5).map((signal) => (
              <div key={signal.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{signal.title}</div>
                  <div className="text-sm text-gray-600">{signal.summary}</div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  signal.importance === 'high' ? 'bg-red-100 text-red-800' :
                  signal.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {signal.importance}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No signals available</p>
        )}
      </div>
    </div>
  );
}
