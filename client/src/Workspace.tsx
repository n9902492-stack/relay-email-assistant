import { useEffect, useState } from 'react';

type Provider = 'gmail' | 'outlook';
type Owner = 'ASSISTANT' | 'CLIENT' | 'NONE';
type Flag = 'important' | 'unread' | 'archived' | 'completed';
type Thread = {
  id: string;
  sender: string;
  subject: string;
  owner: Owner;
  messages: { body: string; receivedAt: string }[];
} & Record<Flag, boolean>;
type Mailbox = { provider: Provider; syncedAt: string; threads: Thread[] };

const providers = { gmail: 'Gmail', outlook: 'Outlook' };
const labels = { ASSISTANT: 'Assistant to Reply', CLIENT: 'Client to Reply', NONE: 'No Reply Needed' };
const segments = [
  ['inbox', 'Inbox'], ['unread', 'Unread'], ['important', 'Important'],
  ['ASSISTANT', labels.ASSISTANT], ['CLIENT', labels.CLIENT], ['NONE', labels.NONE],
  ['completed', 'Completed'], ['archived', 'Archive'],
] as const;
type Segment = (typeof segments)[number][0];
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function belongs(thread: Thread, segment: Segment) {
  if (segment === 'archived') return thread.archived;
  if (thread.archived) return false;
  if (segment === 'completed') return thread.completed;
  if (segment === 'inbox') return true;
  if (segment === 'important' || segment === 'unread') return thread[segment];
  return !thread.completed && thread.owner === segment;
}

async function mailboxRequest(path = '', method = 'GET', body?: object, signal?: AbortSignal) {
  const response = await fetch('/api/mailbox' + path, {
    method, signal,
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Mailbox request failed.');
  return result.mailbox as Mailbox | null;
}

export function Workspace({ name, signOut, signingOut, signOutError }: {
  name: string; signOut: () => void; signingOut: boolean; signOutError: string;
}) {
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [segment, setSegment] = useState<Segment>('inbox');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const thread = mailbox?.threads.find(item => item.id === selected);

  useEffect(() => {
    const controller = new AbortController();
    mailboxRequest('', 'GET', undefined, controller.signal)
      .then(result => {
        setMailbox(result);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load your mailbox. Try again.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  async function update(path: string, label: string, body?: object) {
    setAction(label);
    setError('');
    try {
      const result = await mailboxRequest(path, path.startsWith('/threads/') ? 'PATCH' : 'POST', body);
      setMailbox(result);
    } catch (failure) {
      setError(failure instanceof Error && !(failure instanceof SyntaxError) && !(failure instanceof TypeError)
        ? failure.message : 'Could not reach Relay. Try again.');
    } finally {
      setAction('');
    }
  }

  const search = query.trim().toLowerCase();
  const threads = mailbox?.threads ?? [];
  const filtered = threads.filter(item => belongs(item, segment) && (
    item.sender.toLowerCase().includes(search) || item.subject.toLowerCase().includes(search)
    || item.messages.some(message => message.body.toLowerCase().includes(search))
  ));
  const disabled = Boolean(action) || signingOut;

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span>Relay</div>
        <div className="workspace-user"><span>{name}</span><button className="text-button" disabled={disabled} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
      </header>
      {(signOutError || error) && <p className="workspace-error error" role="alert">{signOutError || error}</p>}
      {loading ? <p className="workspace-status" role="status">Loading mailbox…</p> : !loaded ? (
        <button className="workspace-status text-button" onClick={() => { setLoading(true); setError(''); setAttempt(attempt + 1); }}>Try again</button>
      ) : !mailbox ? (
        <section className="connect">
          <p className="workspace-kicker">Workspace setup</p>
          <h1>Bring your inbox in.</h1>
          <p className="intro">Choose a provider to load the sample inbox. Demo connections use sample emails and never access your account.</p>
          <div className="provider-grid">
            {(['gmail', 'outlook'] as const).map(provider => (
              <button className="provider-card" key={provider} disabled={disabled} onClick={() => update('/connect', provider, { provider })}>
                <span className={'provider-icon ' + provider} aria-hidden="true">{provider === 'gmail' ? 'M' : 'O'}</span>
                <strong>{action === provider ? 'Connecting…' : providers[provider]}</strong>
                <span>Connect demo mailbox <span aria-hidden="true">↗</span></span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="inbox">
          <header className="inbox-top">
            <div><p className="workspace-kicker">Assistant workspace</p><h1>Inbox</h1></div>
            <div className="sync">
              <strong>{providers[mailbox.provider]} demo connected</strong>
              <span role="status">Last synced {dates.format(new Date(mailbox.syncedAt))}</span>
              <button className="secondary" disabled={disabled} onClick={() => update('/sync', 'sync')}>{action === 'sync' ? 'Syncing…' : 'Sync sample inbox'}</button>
            </div>
          </header>
          <div className="inbox-stats">
            {([['inbox', 'Total'], ['unread', 'Unread'], ['important', 'Important'], ['CLIENT', 'Client to Reply']] as const).map(([key, label]) => (
              <button key={key} aria-pressed={segment === key} onClick={() => { setSelected(''); setSegment(key); }}>
                <span>{label}</span><strong>{threads.filter(item => belongs(item, key)).length}</strong>
              </button>
            ))}
          </div>
          <div className={'inbox-body' + (thread ? ' has-selection' : '')}>
            <section className="thread-list" aria-label="Inbox conversations">
              <label>Search conversations<input type="search" placeholder="Sender, subject or message" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <nav className="segments" aria-label="Inbox categories">
                {segments.map(([key, label]) => <button key={key} aria-pressed={segment === key} onClick={() => { setSelected(''); setSegment(key); }}>{label}</button>)}
              </nav>
              {filtered.length ? filtered.map(item => (
                <button className="thread-row" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
                  <span>{item.sender}{item.unread && <span className="unread-dot" aria-label="Unread" />}</span>
                  <strong>{item.subject}</strong>
                  <span className={'thread-owner ' + item.owner.toLowerCase()}>{labels[item.owner]}</span>
                </button>
              )) : <p className="empty">No conversations match this view.</p>}
            </section>
            <section className="thread-detail" aria-label="Conversation detail">
              {thread ? <>
                <button className="text-button back" onClick={() => setSelected('')}>← Back to conversations</button>
                <p className="workspace-kicker">Sample conversation</p>
                <h2>{thread.subject}</h2>
                <p className={'thread-owner ' + thread.owner.toLowerCase()}>{labels[thread.owner]}</p>
                <div className="thread-actions">
                  {([
                    ['important', thread.important ? 'Remove importance' : 'Mark important'],
                    ['unread', thread.unread ? 'Mark read' : 'Mark unread'],
                    ['completed', thread.completed ? 'Reopen' : 'Complete'],
                    ['archived', thread.archived ? 'Move to inbox' : 'Archive'],
                  ] as const).map(([field, label]) =>
                    <button className="secondary" key={field} disabled={disabled} onClick={() => update('/threads/' + thread.id, field, { field, value: !thread[field] })}>
                      {action === field ? 'Saving…' : label}
                    </button>,
                  )}
                </div>
                {thread.messages.map(message => (
                  <article className="thread-message" key={message.receivedAt}>
                    <header><strong>{thread.sender}</strong><time dateTime={message.receivedAt}>{dates.format(new Date(message.receivedAt))}</time></header>
                    <p>{message.body}</p>
                  </article>
                ))}
              </> : <p className="empty">Select a conversation to read the thread.</p>}
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
