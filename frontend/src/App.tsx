import { useEffect, useState } from 'react';
import { checkAuth } from './api';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="login-screen">
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />;
}
