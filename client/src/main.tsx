import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type User = { name: string; email: string };
type Mode = 'signin' | 'signup';

const routes = [
  { initials: 'JD', subject: 'Approve the revised proposal', sender: 'Jamie Davis', owner: 'Client to reply', tone: 'lavender' },
  { initials: 'AP', subject: 'Move Thursday’s check-in?', sender: 'Alex Parker', owner: 'Assistant to reply', tone: 'mint' },
  { initials: 'ST', subject: 'Your statement is ready', sender: 'Studio Billing', owner: 'No reply needed', tone: 'sand' },
];

function Preview() {
  return (
    <aside className="preview" aria-label="Example inbox triage">
      <div className="preview-content">
        <p className="preview-label"><span /> Inbox triage preview</p>
        <h2>Give every email<br />a next step.</h2>
        <p className="preview-description">See what you can handle, what needs your client, and what can wait.</p>
        <div className="message-stack">
          {routes.map((message, index) => (
            <div className={`message ${message.tone}`} key={message.subject} style={{ animationDelay: `${index * 140}ms` }}>
              <span className="avatar">{message.initials}</span>
              <div className="message-text"><strong>{message.subject}</strong><span>{message.sender}</span></div>
              <span className="owner">{message.owner}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>('signin');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then(async response => { if (response.ok) setUser((await response.json()).user); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUser(result.user);
    } catch (failure) {
      setError(failure instanceof Error && !(failure instanceof SyntaxError) && !(failure instanceof TypeError)
        ? failure.message : 'Relay could not reach the server. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setUser(null);
      setMode('signin');
    } catch {
      setError('Could not sign out. Try again.');
    } finally {
      setPending(false);
    }
  }

  function changeMode() {
    setError('');
    setVisible(false);
    setMode(signup ? 'signin' : 'signup');
  }

  return (
    <main className="shell">
      <section className="entry">
        <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span>Relay</div>
        {loading ? <p className="form-panel" role="status">Loading Relay…</p> : user ? (
          <div className="form-panel">
            <h1>Welcome, {user.name}.</h1>
            <p className="intro">Signed in as {user.email}.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="primary" disabled={pending} onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="form-panel" key={mode}>
            <h1>{signup ? 'Make room for focus.' : 'Back to your inbox.'}</h1>
            <p className="intro">{signup ? 'Create an account to start managing client email.' : 'Sign in to manage your clients’ conversations.'}</p>
            <form onSubmit={submit} className="grid gap-4">
              {signup && <label>Full name<input name="name" autoComplete="name" maxLength={80} placeholder="Alex Morgan" required /></label>}
              <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
              <label htmlFor="password">Password</label>
              <div className="password">
                <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} maxLength={128} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} required />
                <button type="button" className="text-button" aria-controls="password" onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="primary" disabled={pending}>{pending ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<span aria-hidden="true">↗</span></button>
            </form>
            <p className="switch">{signup ? 'Already have an account?' : 'New to Relay?'} <button type="button" className="text-button" disabled={pending} onClick={changeMode}>{signup ? 'Sign in' : 'Create an account'}</button></p>
          </div>
        )}
      </section>
      <Preview />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
