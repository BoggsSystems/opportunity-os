import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthResponse, WorkspaceState, WorkspaceSignalSummary, SubscriptionSummary, UsageSummary } from '../types';

// Auth Store
interface AuthState {
  user: AuthResponse['user'] | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setAuth: (authResponse: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        setAuth: (authResponse) => {
          set({
            user: authResponse.user,
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken,
            isAuthenticated: true,
            error: null,
          });
        },

        setTokens: (accessToken, refreshToken) => {
          set({ accessToken, refreshToken, isAuthenticated: true });
        },

        clearAuth: () => {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          });
        },

        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'auth' }
  )
);

// Workspace Store
interface WorkspaceStore {
  workspaceState: WorkspaceState | null;
  signals: WorkspaceSignalSummary[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setWorkspaceState: (state: WorkspaceState) => void;
  setSignals: (signals: WorkspaceSignalSummary[]) => void;
  addSignal: (signal: WorkspaceSignalSummary) => void;
  updateSignal: (id: string, updates: Partial<WorkspaceSignalSummary>) => void;
  removeSignal: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set) => ({
      workspaceState: null,
      signals: [],
      isLoading: false,
      error: null,

      setWorkspaceState: (workspaceState) => set({ workspaceState }),
      
      setSignals: (signals) => set({ signals }),
      
      addSignal: (signal) => set((state) => ({
        signals: [signal, ...state.signals]
      })),
      
      updateSignal: (id, updates) => set((state) => ({
        signals: state.signals.map(signal =>
          signal.id === id ? { ...signal, ...updates } : signal
        )
      })),
      
      removeSignal: (id) => set((state) => ({
        signals: state.signals.filter(signal => signal.id !== id)
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearWorkspace: () => set({ workspaceState: null, signals: [], error: null }),
    }),
    { name: 'workspace' }
  )
);

// Subscription Store
interface SubscriptionStore {
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSubscription: (subscription: SubscriptionSummary) => void;
  setUsage: (usage: UsageSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSubscription: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  devtools(
    persist(
      (set) => ({
        subscription: null,
        usage: null,
        isLoading: false,
        error: null,

        setSubscription: (subscription) => set({ subscription }),
        setUsage: (usage) => set({ usage }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        clearSubscription: () => set({ subscription: null, usage: null, error: null }),
      }),
      {
        name: 'subscription-storage',
        partialize: (state) => ({
          subscription: state.subscription,
          usage: state.usage,
        }),
      }
    ),
    { name: 'subscription' }
  )
);

// UI Store for global UI state
interface UIStore {
  sidebarOpen: boolean;
  conductorExpanded: boolean;
  podiumMode: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: number;
    autoClose?: boolean;
  }>;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleConductor: () => void;
  setConductorExpanded: (expanded: boolean) => void;
  setPodiumMode: (active: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        sidebarOpen: true,
        conductorExpanded: true,
        podiumMode: false,
        theme: 'system',
        notifications: [],
        
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleConductor: () => set((state) => ({ conductorExpanded: !state.conductorExpanded })),
        setConductorExpanded: (expanded) => set({ conductorExpanded: expanded }),
        setPodiumMode: (active) => set({ podiumMode: active }),
        setTheme: (theme) => set({ theme }),
        
        addNotification: (notification) => {
          const id = Math.random().toString(36).substr(2, 9);
          const timestamp = Date.now();
          const newNotification = { ...notification, id, timestamp };
          
          set((state) => ({
            notifications: [...state.notifications, newNotification]
          }));

          // Auto-close notification after 5 seconds if specified
          if (notification.autoClose !== false) {
            setTimeout(() => {
              get().removeNotification(id);
            }, 5000);
          }
        },
        
        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        })),
        
        clearNotifications: () => set({ notifications: [] }),
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          conductorExpanded: state.conductorExpanded,
          theme: state.theme,
        }),
      }
    ),
    { name: 'ui' }
  )
);

// Combined store hooks for convenience
export const useStore = () => {
  const auth = useAuthStore();
  const workspace = useWorkspaceStore();
  const subscription = useSubscriptionStore();
  const ui = useUIStore();

  return {
    auth,
    workspace,
    subscription,
    ui,
  };
};
