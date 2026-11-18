# Relay Email Assistant

Relay is a MERN prototype for personal assistants managing client email. This first milestone covers the animated entry screens, MongoDB-backed sign-up and sign-in, session restoration and sign-out. The entry screen includes an illustrative inbox triage preview.

## Run locally

1. Use Node.js 22.12 or later and start a local MongoDB instance, or use a MongoDB connection string.
2. Copy `server/.env.example` to `server/.env` and set the MongoDB connection values. Keep the API on port 4000 for the default Vite proxy.
3. Run `npm ci` and `npm run dev` from the repo root. Open the URL printed by Vite.

Run `npm run build` to type-check and build the client. After building, `npm start` serves the API and client together. Use HTTPS with `NODE_ENV=production`.

## Next milestone

Add mailbox onboarding and sync, the assistant inbox, automatic reply classification, the client handoff flow and AI-assisted drafting.
