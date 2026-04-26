import { useState } from 'react';
import { ApiClient } from '../lib/api';
import type { AuthResponse } from '../types';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthResponse['user'];
}

interface UseAuthReturn {
  session: StoredSession | null;
  isWorking: boolean;
  notice: Notice | null;
  handleAuth: (mode: 'login' | 'signup', email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  setNotice: (notice: Notice | null) => void;
}

const STORAGE_KEY = 'opportunity-os-session';

function readSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export const useAuth = (): UseAuthReturn => {
  const [session, setSession] = useState<StoredSession | null>(() => readSession());
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const api = new ApiClient(session?.accessToken ?? null);

  const handleAuth = async (mode: 'login' | 'signup', email: string, password: string, fullName?: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      const auth =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.signup({
              email,
              password,
              fullName: fullName || 'Test Operator',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
      
      const stored = {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: auth.user,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setSession(stored);
    } catch (error) {
      setNotice({
        title: mode === 'login' ? 'Login failed' : 'Signup failed',
        detail: error instanceof Error ? error.message : 'Authentication failed.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setNotice(null);
  };

  return {
    session,
    isWorking,
    notice,
    handleAuth,
    logout,
    setNotice,
  };
};
