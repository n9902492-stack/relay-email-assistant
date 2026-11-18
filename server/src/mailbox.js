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
  app.use('/api/mailbox', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, requireUser);

  app.get('/api/mailbox', async (req, res) => {
    const mailbox = await mailboxes.findOne({ _id: req.user._id });
    res.json({ mailbox });
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
    res.json({ mailbox });
  });

  app.post('/api/mailbox/sync', async (req, res) => {
    const mailbox = await mailboxes.findOneAndUpdate(
      { _id: req.user._id },
      { $set: { syncedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!mailbox) return res.status(404).json({ error: 'Connect a mailbox first.' });
    res.json({ mailbox });
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
    res.json({ mailbox });
  });
}
