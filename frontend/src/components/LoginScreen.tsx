import { FormEvent, useState } from 'react';
import { login } from '../api';

interface Props {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(passphrase);
      onSuccess();
    } catch {
      setError('Invalid passphrase. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>IT Links Dashboard</h1>
        <p>Enter the team passphrase to access shared bookmarks.</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
