import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '../../store';
import { createMockAuthResponse } from '../utils';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.getState().clearAuth();
  });

  it('initializes with correct default state', () => {
    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets auth state correctly', () => {
    const mockAuth = createMockAuthResponse();
    
    act(() => {
      useAuthStore.getState().setAuth(mockAuth);
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockAuth.user);
    expect(state.accessToken).toBe(mockAuth.accessToken);
    expect(state.refreshToken).toBe(mockAuth.refreshToken);
    expect(state.isAuthenticated).toBe(true);
    expect(state.error).toBeNull();
  });

  it('sets tokens correctly', () => {
    const accessToken = 'new-access-token';
    const refreshToken = 'new-refresh-token';
    
    act(() => {
      useAuthStore.getState().setTokens(accessToken, refreshToken);
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(accessToken);
    expect(state.refreshToken).toBe(refreshToken);
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears auth state correctly', () => {
    const mockAuth = createMockAuthResponse();
    
    // First set auth
    act(() => {
      useAuthStore.getState().setAuth(mockAuth);
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Then clear it
    act(() => {
      useAuthStore.getState().clearAuth();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets loading state correctly', () => {
    act(() => {
      useAuthStore.getState().setLoading(true);
    });

    expect(useAuthStore.getState().isLoading).toBe(true);

    act(() => {
      useAuthStore.getState().setLoading(false);
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets error state correctly', () => {
    const errorMessage = 'Test error message';
    
    act(() => {
      useAuthStore.getState().setError(errorMessage);
    });

    expect(useAuthStore.getState().error).toBe(errorMessage);

    act(() => {
      useAuthStore.getState().setError(null);
    });

    expect(useAuthStore.getState().error).toBeNull();
  });

  it('clears error when setting auth', () => {
    // First set an error
    act(() => {
      useAuthStore.getState().setError('Previous error');
    });

    expect(useAuthStore.getState().error).toBe('Previous error');

    // Then set auth (should clear error)
    const mockAuth = createMockAuthResponse();
    act(() => {
      useAuthStore.getState().setAuth(mockAuth);
    });

    expect(useAuthStore.getState().error).toBeNull();
  });

  it('persists state to localStorage', () => {
    const mockAuth = createMockAuthResponse();
    
    act(() => {
      useAuthStore.getState().setAuth(mockAuth);
    });

    // Check localStorage was called
    expect(localStorage.getItem('auth-storage')).toBeTruthy();
  });
});
