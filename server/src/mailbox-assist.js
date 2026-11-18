import { requestMailboxModel } from './mailbox-model.js';

const detail = thread => ({
  id: thread.id,
  sender: thread.sender,
  subject: thread.subject,
  owner: thread.override ?? thread.classification?.owner ?? thread.owner,
  important: thread.important,
  unread: thread.unread,
  reason: thread.classification?.reason,
  messages: thread.messages.slice(-5).map(message => message.body.slice(0, 1000)),
});

function localAnswer(question, threads) {
  const text = question.toLowerCase();
  const terms = text.match(/[a-z0-9]{3,}/g) ?? [];
  const stopWords = new Set(['what', 'which', 'show', 'the', 'emails', 'email', 'about', 'tell', 'message', 'messages', 'need', 'any', 'with', 'from', 'are', 'does']);
  const keywords = terms.filter(word => !stopWords.has(word));
  const filters = [
    [/\b(client|approval|approvals)\b/, thread => thread.owner === 'CLIENT'],
    [/\bassistant\b/, thread => thread.owner === 'ASSISTANT'],
    [/\bunread\b/, thread => thread.unread],
    [/\bimportant\b/, thread => thread.important],
    [/\bno reply\b/, thread => thread.owner === 'NONE'],
  ].filter(([pattern]) => pattern.test(text)).map(([, match]) => match);
  const matches = threads.filter(thread => filters.length
    ? filters.every(match => match(thread))
    : keywords.some(word => [thread.sender, thread.subject, ...thread.messages].join(' ').toLowerCase().includes(word)));
  return {
    answer: matches.length
      ? matches.map(thread => thread.subject + ' — ' + (filters.length && thread.reason ? thread.reason : thread.messages.at(-1))).join('\n')
      : 'No matching active conversations. Try a sender, subject, or a category such as unread or client replies.',
    threadIds: matches.map(thread => thread.id),
    source: 'rules',
  };
}

export async function answerInbox(question, mailboxThreads) {
  const threads = mailboxThreads.filter(thread => !thread.archived && !thread.completed).slice(0, 30).map(detail);
  if (process.env.OPENAI_API_KEY && threads.length) {
    try {
      const result = await requestMailboxModel(
        'Answer questions about the supplied active sample inbox only. Return JSON with answer (brief text) and threadIds (array of supporting IDs from the supplied threads). Say when the inbox does not provide enough information. Do not invent messages, approvals, or commitments.',
        { question, threads },
      );
      if (typeof result.answer === 'string' && result.answer.trim() && Array.isArray(result.threadIds)) {
        const ids = new Set(threads.map(thread => thread.id));
        return { answer: result.answer.slice(0, 3000), threadIds: [...new Set(result.threadIds.filter(id => ids.has(id)))], source: 'ai' };
      }
    } catch {
      return localAnswer(question, threads);
    }
  }
  return localAnswer(question, threads);
}

export async function draftReply(thread, name) {
  const context = detail(thread);
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await requestMailboxModel(
        'Write a concise, professional email reply for review. Return JSON with body (plain text including greeting and signature). Use the supplied sender and history. Never invent a decision, approval, date, or commitment. If the thread is already resolved, only acknowledge it.',
        { thread: context, signature: name },
      );
      if (typeof result.body === 'string' && result.body.trim()) {
        return { body: result.body.trim().slice(0, 4000), source: 'ai' };
      }
    } catch {
      // The demo template remains available if the model request fails.
    }
  }

  const greeting = 'Hi ' + thread.sender.split(' ')[0] + ',';
  const body = {
    ASSISTANT: 'Thanks for reaching out. I’ll check the details and follow up once I have an update.',
    CLIENT: 'Thanks for sending this over. I’ll share this for review and follow up once I have an update.',
    NONE: 'Thanks for the update. I appreciate you letting me know.',
  }[context.owner] ?? 'Thanks for the message. I’ll review it and follow up if needed.';
  return { body: greeting + '\n\n' + body + '\n\nBest,\n' + name, source: 'rules' };
}
