import React, { useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface AuthScreenProps {
  apiBaseUrl: string;
  isWorking: boolean;
  notice: {
    title: string;
    detail: string;
    tone: 'info' | 'success' | 'warning' | 'error';
  } | null;
  onAuth: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>;
  initialMode?: 'login' | 'signup';
  initialStrategy?: any;
}

const TEST_PASSWORD = 'Password123!';

export const AuthScreen: React.FC<AuthScreenProps> = (props) => {
  const [mode, setMode] = useState<'login' | 'signup'>(props.initialMode || 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(TEST_PASSWORD);
  const [fullName, setFullName] = useState('Test Operator');

  function useGeneratedUser() {
    setMode('signup');
    setFullName('Test Operator');
    setPassword(TEST_PASSWORD);
    setEmail(`web-test-${Date.now()}@example.com`);
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-row">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="eyebrow">Opportunity OS</p>
            <h1>AI-led opportunity execution</h1>
          </div>
        </div>

        <p className="auth-copy">
          Enter the workspace where the assistant stays central and each cycle moves from signal to execution.
        </p>

        <div className="segmented-control" aria-label="Authentication mode">
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            Sign up
          </button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Log in
          </button>
        </div>

        {props.notice ? <NoticeBanner notice={props.notice} compact /> : null}

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onAuth(mode, email, password, fullName, props.initialStrategy);
          }}
        >
          {mode === 'signup' ? (
            <label>
              Name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Test Operator" />
            </label>
          ) : null}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>

          <div className="auth-actions">
            <button className="primary-button" disabled={props.isWorking || !email || !password} type="submit">
              {props.isWorking ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
              {mode === 'signup' ? 'Create account' : 'Enter workspace'}
            </button>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <button 
              className="google-button" 
              type="button"
              onClick={() => {
                const url = new URL(`${props.apiBaseUrl}/auth/google`);
                // If we have a guest session, pass it so the backend can link it
                const guestId = localStorage.getItem('guestSessionId');
                if (guestId) url.searchParams.append('guestSessionId', guestId);
                window.location.href = url.toString();
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
              Continue with Google
            </button>
            <button 
              className="linkedin-button" 
              type="button"
              onClick={() => {
                const url = new URL(`${props.apiBaseUrl}/auth/linkedin`);
                const guestId = localStorage.getItem('guestSessionId');
                if (guestId) url.searchParams.append('guestSessionId', guestId);
                window.location.href = url.toString();
              }}
            >
              <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="" />
              Continue with LinkedIn
            </button>
            <button className="secondary-button" disabled={props.isWorking} onClick={useGeneratedUser} type="button">
              Create test user
            </button>
          </div>
        </form>

        <p className="api-note">API: {props.apiBaseUrl}</p>
      </section>
    </main>
  );
};

// Temporary NoticeBanner component - this should be moved to a shared components folder
interface NoticeBannerProps {
  notice: {
    title: string;
    detail: string;
    tone: 'info' | 'success' | 'warning' | 'error';
  };
  compact?: boolean;
  onDismiss?: () => void;
}

const NoticeBanner: React.FC<NoticeBannerProps> = ({ notice, compact, onDismiss }) => {
  return (
    <div className={`notice-banner notice-${notice.tone} ${compact ? 'compact' : ''}`}>
      <div className="notice-content">
        <h4>{notice.title}</h4>
        <p>{notice.detail}</p>
      </div>
      {onDismiss && (
        <button className="notice-dismiss" onClick={onDismiss} type="button">
          ×
        </button>
      )}
    </div>
  );
};
