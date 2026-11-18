import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import { registerMailbox } from './mailbox.js';

const deriveKey = promisify(scrypt);
const app = express();
if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required in production.');
}
const db = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017')
  .db(process.env.MONGODB_DB || 'relay');
const users = db.collection('users');
const sessions = db.collection('sessions');
const sessionAge = 7 * 24 * 60 * 60 * 1000;
await Promise.all([
  users.createIndex({ email: 1 }, { unique: true }),
  sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
]);

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: 'Too many attempts. Try again later.' } });
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function sessionId(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)relay_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token ? hashToken(token) : null;
}

function profile(user) {
  return { name: user.name, email: user.email };
}

async function signIn(req, res, user, status) {
  const oldSession = sessionId(req);
  if (oldSession) await sessions.deleteOne({ _id: oldSession });
  const token = randomBytes(32).toString('hex');
  await sessions.insertOne({ _id: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + sessionAge) });
  res.cookie('relay_session', token, { ...cookie, maxAge: sessionAge }).status(status).json({ user: profile(user) });
}

function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return null;
  return { email, password };
}

app.post('/api/auth/signup', authLimit, async (req, res) => {
  const input = credentials(req.body);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!input || !name || name.length > 80) return res.status(400).json({ error: 'Enter your name, a valid email, and a password of 8–128 characters.' });
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(input.password, salt, 64);
  const user = { name, email: input.email, salt, passwordHash: key.toString('hex') };
  try {
    await users.insertOne(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This email already has an account.' });
    throw error;
  }
  await signIn(req, res, user, 201);
});

app.post('/api/auth/signin', authLimit, async (req, res) => {
  const invalid = { error: 'Email or password is incorrect.' };
  const input = credentials(req.body);
  if (!input) return res.status(401).json(invalid);
  const user = await users.findOne({ email: input.email });
  const key = await deriveKey(input.password, user?.salt ?? 'relay-missing-user', 64);
  if (!user || !timingSafeEqual(key, Buffer.from(user.passwordHash, 'hex'))) return res.status(401).json(invalid);
  await signIn(req, res, user, 200);
});

async function requireUser(req, res, next) {
  const id = sessionId(req);
  const session = id && await sessions.findOne({ _id: id, expiresAt: { $gt: new Date() } });
  const user = session && await users.findOne({ _id: session.userId });
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user;
  next();
}

app.get('/api/auth/me', requireUser, (req, res) => res.json({ user: profile(req.user) }));

app.post('/api/auth/signout', async (req, res) => {
  const id = sessionId(req);
  if (id) await sessions.deleteOne({ _id: id });
  res.clearCookie('relay_session', cookie).sendStatus(204);
});

app.get('/api/health', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await db.command({ ping: 1 }, { timeoutMS: 2000 });
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

registerMailbox(app, db, requireUser);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) app.use(express.static(clientDist));
app.use((error, _req, res, _next) => {
  if (error.status === 413) return res.status(413).json({ error: 'Request body is too large.' });
  if (error.status === 400) return res.status(400).json({ error: 'Invalid request.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});

app.listen(Number(process.env.PORT || 4000), () => console.log('Relay API is ready.'));
