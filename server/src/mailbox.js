import { classify, owners } from './classification.js';

const examples = [
  ['proposal', 'Jamie Davis', 'Revised proposal needs your approval', 'CLIENT', true, true, [
    'I updated the scope after our call. The new estimate is £4,800 and includes two revision rounds.',
    'Could you personally approve the revised scope by Friday so I can reserve the team?',
  ]],
  ['check-in', 'Alex Parker', 'Move Thursday’s check-in?', 'ASSISTANT', false, true, [
    'Thursday at 10 no longer works for our team. Could you check if Friday at 2 or 3 works?',
  ]],
  ['statement', 'Studio Billing', 'Your monthly statement is ready', 'NONE', false, false, [
    'Your October statement is available for your records. Your balance has already been paid.',
  ]],
  ['intro', 'Priya Mehta', 'Introduction to the partnerships team', 'ASSISTANT', false, true, [
    'I introduced Maya on our last call. Could you send her two times for an introductory meeting?',
  ]],
  ['renewal', 'Sam Chen', 'Decision needed on renewal terms', 'CLIENT', true, false, [
    'The vendor offered a twelve-month renewal at the current rate. Please confirm whether you want to commit before Monday.',
  ]],
  ['newsletter', 'Studio Notes', 'November studio notes', 'NONE', false, false, [
    'Here are this month’s studio updates and a roundup of upcoming events.',
  ]],
];

function seedThreads(now) {
  return examples.map(([id, sender, subject, owner, important, unread, messages], index) => ({
    id, sender, subject, owner, important, unread, archived: false, completed: false,
    messages: messages.map((body, messageIndex) => ({
      body,
      receivedAt: new Date(now - (index * 26 + messages.length - messageIndex) * 3600000),
    })),
  }));
}

export function registerMailbox(app, db, requireUser) {
  const mailboxes = db.collection('mailboxes');

  async function classifyPending(mailbox) {
    const threads = mailbox.threads.filter(thread => thread.classification?.messageCount !== thread.messages.length
      || (process.env.OPENAI_API_KEY && thread.classification?.source === 'rules'));
    if (!threads.length) return mailbox;
    await Promise.all(threads.map(async thread => {
      const classification = await classify(thread);
      await mailboxes.updateOne(
        { _id: mailbox._id, threads: { $elemMatch: {
          id: thread.id,
          messages: { $size: thread.messages.length },
          ...(classification.source === 'rules' && { $or: [
            { 'classification.source': { $ne: 'ai' } },
            { 'classification.messageCount': { $ne: thread.messages.length } },
          ] }),
        } } },
        { $set: { 'threads.$.classification': { ...classification, messageCount: thread.messages.length } } },
      );
    }));
    return mailboxes.findOne({ _id: mailbox._id });
  }

  function sendMailbox(res, mailbox) {
    res.json({ mailbox: mailbox && {
      ...mailbox,
      threads: mailbox.threads.map(thread => ({
        ...thread,
        owner: thread.override ?? thread.classification?.owner ?? thread.owner,
      })),
    } });
  }
  app.use('/api/mailbox', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, requireUser);

  app.get('/api/mailbox', async (req, res) => {
    const mailbox = await mailboxes.findOne({ _id: req.user._id });
    sendMailbox(res, mailbox);
  });

  app.post('/api/mailbox/connect', async (req, res) => {
    const provider = req.body?.provider;
    if (provider !== 'gmail' && provider !== 'outlook') {
      return res.status(400).json({ error: 'Choose Gmail or Outlook.' });
    }

    const now = Date.now();
    const mailbox = await mailboxes.findOneAndUpdate(
      { _id: req.user._id },
      {
        $set: { provider, syncedAt: new Date(now) },
        $setOnInsert: { threads: seedThreads(now) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    sendMailbox(res, await classifyPending(mailbox));
  });

  app.post('/api/mailbox/sync', async (req, res) => {
    const mailbox = await mailboxes.findOneAndUpdate(
      { _id: req.user._id },
      { $set: { syncedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!mailbox) return res.status(404).json({ error: 'Connect a mailbox first.' });
    sendMailbox(res, await classifyPending(mailbox));
  });

  app.post('/api/mailbox/demo-follow-up', async (req, res) => {
    await mailboxes.updateOne(
      { _id: req.user._id, threads: { $elemMatch: { id: 'proposal', 'messages.demoFollowUp': { $ne: true } } } },
      {
        $push: { 'threads.$.messages': {
          body: 'The director already approved the scope. No reply needed. Thanks for coordinating!',
          receivedAt: new Date(), demoFollowUp: true,
        } },
        $set: { 'threads.$.unread': true },
      },
    );
    const mailbox = await mailboxes.findOne({ _id: req.user._id });
    if (!mailbox) return res.status(404).json({ error: 'Connect a mailbox first.' });
    sendMailbox(res, await classifyPending(mailbox));
  });

  app.patch('/api/mailbox/threads/:id/routing', async (req, res) => {
    const { action, owner } = req.body ?? {};
    let change;
    if (action === 'override' && (owner === null || owners.includes(owner))) {
      change = { 'threads.$.override': owner };
    } else if (action === 'takeover') {
      change = { 'threads.$.override': 'ASSISTANT' };
    } else if (action === 'handled') {
      change = { 'threads.$.completed': true };
    } else {
      return res.status(400).json({ error: 'Choose a valid routing action.' });
    }
    const mailbox = await mailboxes.findOneAndUpdate(
      { _id: req.user._id, 'threads.id': req.params.id },
      { $set: change },
      { returnDocument: 'after' },
    );
    if (!mailbox) return res.status(404).json({ error: 'Conversation not found.' });
    sendMailbox(res, mailbox);
  });

  app.patch('/api/mailbox/threads/:id', async (req, res) => {
    const { field, value } = req.body ?? {};
    if (!['important', 'unread', 'archived', 'completed'].includes(field) || typeof value !== 'boolean') {
      return res.status(400).json({ error: 'Choose a valid conversation action.' });
    }
    const mailbox = await mailboxes.findOneAndUpdate(
      { _id: req.user._id, 'threads.id': req.params.id },
      { $set: { ['threads.$.' + field]: value } },
      { returnDocument: 'after' },
    );
    if (!mailbox) return res.status(404).json({ error: 'Conversation not found.' });
    sendMailbox(res, mailbox);
  });
}
