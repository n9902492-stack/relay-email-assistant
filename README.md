# Relay Email Assistant

Relay is a MERN prototype for personal assistants managing client email. The prototype includes animated entry screens, MongoDB-backed accounts, persistent sessions, and an assistant inbox backed by demo mailboxes.

## Run locally

1. Use Node.js 22.12 or later and start a local MongoDB instance, or use a MongoDB connection string.
2. Copy `server/.env.example` to `server/.env` and set the MongoDB connection values. Keep the API on port 4000 for the default Vite proxy.
3. Run `npm ci` and `npm run dev` from the repo root. Open the URL printed by Vite.

Run `npm run build` to type-check and build the client. After building, `npm start` serves the API and client together. Use HTTPS with `NODE_ENV=production`.

## Try the demo

Create an account and choose Gmail or Outlook. Both options load a sample inbox without accessing an external account. Sync refreshes the connection timestamp while preserving changes to sample threads. Search by sender, subject, or message text. Filter by reply responsibility and try marking a conversation read, important, completed, or archived.

Reply responsibility labels are part of the sample data. Automatic classification, the client handoff view, and AI-assisted summaries and drafting are upcoming.
