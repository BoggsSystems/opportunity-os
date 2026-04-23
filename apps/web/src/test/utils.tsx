import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  fullName: 'Test User',
  timezone: 'UTC',
  emailVerifiedAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockAuthResponse = (overrides = {}) => ({
  user: createMockUser(),
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresIn: 3600,
  ...overrides,
});

export const createMockWorkspaceSignal = (overrides = {}) => ({
  id: 'test-signal-id',
  sourceType: 'opportunity',
  sourceId: 'test-opportunity-id',
  title: 'Test Signal',
  summary: 'This is a test signal',
  importance: 'medium',
  status: 'new',
  priorityScore: 50,
  recommendedAction: 'review',
  recommendedWorkspaceMode: 'signal_review',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockWorkspaceState = (overrides = {}) => ({
  mode: 'signal_review',
  activeCycleId: null,
  signalCount: 5,
  opportunityCount: 3,
  goalCount: 2,
  campaignCount: 1,
  lastActivityAt: new Date().toISOString(),
  ...overrides,
});

export const createMockSubscription = (overrides = {}) => ({
  plan: {
    id: 'test-plan-id',
    code: 'free',
    name: 'Free Plan',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    currency: 'USD',
    isActive: true,
  },
  status: 'active',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

// Mock API responses
export const mockApiResponse = function<T>(data: T, status = 200) {
  return {
    ok: true,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
};

export const mockApiError = (message: string, status = 400) => ({
  ok: false,
  status,
  json: async () => ({ error: message }),
  text: async () => JSON.stringify({ error: message }),
} as Response);

// Test helpers
export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 0));

export const createMockEvent = (type: string, properties = {}) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: {
    value: '',
    checked: false,
    ...properties,
  },
  currentTarget: {
    value: '',
    checked: false,
    ...properties,
  },
  ...properties,
});
