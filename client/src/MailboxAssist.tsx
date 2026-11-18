import { useState } from 'react';
import type { FormEvent } from 'react';
import { requestMailbox } from './mailbox-request';

type Source = 'ai' | 'rules';
type Answer = { answer: string; threadIds: string[]; source: Source };
const suggestedQuestions = ['Which emails need the client?', 'Show unread emails', 'What did Jamie ask for?'];

function messageFor(error: unknown) {
  return error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
    ? error.message : 'Could not reach Relay. Try again.';
}

export function InboxQuestions({ threads, openThread }: {
  threads: { id: string; subject: string }[];
  openThread: (id: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer>();
  const [asked, setAsked] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function ask(value: string) {
    if (!value.trim() || pending) return;
    setQuestion(value);
    setAsked(value.trim());
    setAnswer(undefined);
    setPending(true);
    setError('');
    try {
      setAnswer(await requestMailbox<Answer>('/ask', 'POST', { question: value }));
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="assist-panel" aria-labelledby="ask-heading">
      <h2 id="ask-heading">Ask your inbox</h2>
      <form onSubmit={submit} className="ask-form">
        <label htmlFor="inbox-question" className="sr-only">Question about your inbox</label>
        <input id="inbox-question" value={question} maxLength={500} placeholder="Ask about your active conversations" onChange={event => setQuestion(event.target.value)} required />
        <button className="primary" disabled={pending || !question.trim()}>{pending ? 'Looking…' : 'Ask'}</button>
      </form>
      <div className="assist-suggestions">
        {suggestedQuestions.map(value => <button className="secondary" key={value} disabled={pending} onClick={() => ask(value)}>{value}</button>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {answer && <div className="assist-answer" aria-live="polite">
        <strong>{asked}</strong>
        <small>{answer.source === 'ai' ? 'AI answer' : 'Rule-based inbox match'}</small>
        <p>{answer.answer}</p>
        {answer.threadIds.map(id => {
          const thread = threads.find(item => item.id === id);
          return thread && <button className="text-button" key={id} onClick={() => openThread(id)}>{thread.subject} ↗</button>;
        })}
      </div>}
    </section>
  );
}

export function ReplyDraft({ id, sender, savedDraft, onSaved }: {
  id: string; sender: string; savedDraft?: string; onSaved: (body: string) => void;
}) {
  const [body, setBody] = useState(savedDraft ?? '');
  const [source, setSource] = useState<Source>();
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const path = '/threads/' + encodeURIComponent(id) + '/draft';

  async function generate() {
    setPending('generate');
    setError('');
    setNotice('');
    try {
      const result = await requestMailbox<{ body: string; source: Source }>(path, 'POST');
      setBody(result.body);
      setSource(result.source);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setPending('');
    }
  }

  async function save() {
    setPending('save');
    setError('');
    try {
      const result = await requestMailbox<{ draft: string }>(path, 'PUT', { body });
      setBody(result.draft);
      onSaved(result.draft);
      setReview(false);
      setNotice('Draft approved and saved.');
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setPending('');
    }
  }

  return (
    <section className="assist-panel reply-panel" aria-labelledby="draft-heading">
      <h3 id="draft-heading">Reply draft</h3>
      <p>For {sender}. Demo drafts are saved in Relay.</p>
      {review ? <>
        <div className="draft-preview" aria-label="Reply preview">{body.trim()}</div>
        <div className="assist-suggestions">
          <button className="secondary" disabled={Boolean(pending)} onClick={() => setReview(false)}>Back to editing</button>
          <button className="primary" disabled={Boolean(pending)} onClick={save}>{pending === 'save' ? 'Saving…' : 'Approve and save draft'}</button>
        </div>
      </> : <>
        <button className="secondary" disabled={Boolean(pending) || Boolean(body.trim())} onClick={generate}>{pending === 'generate' ? 'Drafting…' : 'Generate draft'}</button>
        {source && <small>{source === 'ai' ? 'AI suggestion' : 'Template suggestion'}</small>}
        <textarea aria-label="Reply text" value={body} rows={6} maxLength={4000} disabled={Boolean(pending)} placeholder="Write or generate a reply…" onChange={event => { setBody(event.target.value); setNotice(''); }} />
        <button className="secondary" disabled={Boolean(pending) || !body.trim()} onClick={() => { setReview(true); setNotice(''); }}>Review draft</button>
      </>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
