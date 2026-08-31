import { useState, type FormEvent } from 'react';

interface LoginScreenProps {
  apiUrl: string;
  onAuthenticated: (accessToken: string) => void;
}

function LoginScreen({ apiUrl, onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    const body = mode === 'login' ? { email, password } : { username, email, password };

    try {
      const res = await fetch(`${apiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Unbekannter Fehler');
        return;
      }

      onAuthenticated(data.accessToken);
    } catch {
      setError('Server nicht erreichbar');
    } finally {
      setLoading(false);
    }
  };

  const playAsGuest = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/guest`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Unbekannter Fehler');
        return;
      }

      onAuthenticated(data.accessToken);
    } catch {
      setError('Server nicht erreichbar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game">
      <h1 className="brand">Great Galguti</h1>
      <form onSubmit={submit} className="login-form">
        <h2>{mode === 'login' ? 'Einloggen' : 'Registrieren'}</h2>

        {mode === 'register' && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}
        <div className="field-with-hint">
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="field-hint">Die E-Mail-Adresse wird nicht dauerhaft gespeichert.</p>
        </div>
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="action-button" disabled={loading}>
          {mode === 'login' ? 'Einloggen' : 'Registrieren'}
        </button>

        <div className="login-divider">oder</div>

        <button type="button" className="action-button secondary" onClick={playAsGuest} disabled={loading}>
          Als Gast spielen
        </button>

        <button
          type="button"
          className="login-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Noch keinen Account? Registrieren' : 'Schon registriert? Einloggen'}
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;
