# Relay Email Assistant

Relay is a MERN prototype for personal assistants managing client email. The prototype includes animated entry screens, MongoDB-backed accounts, persistent sessions, and an assistant inbox backed by demo mailboxes.

## Run locally

1. Use Node.js 22.12 or later and start a local MongoDB instance, or use a MongoDB connection string.
2. Copy `server/.env.example` to `server/.env` and set the MongoDB connection values. Keep the API on port 4000 for the default Vite proxy.
3. Run `npm ci` and `npm run dev` from the repo root. Open the URL printed by Vite.

Run `npm run build` to type-check and build the client. After building, `npm start` serves the API and client together. Use HTTPS with `NODE_ENV=production`.

## Try the demo

Create an account and choose Gmail or Outlook. Both options load a sample inbox without accessing an external account. Sync refreshes the connection timestamp while preserving changes to sample threads. Search by sender, subject, or message text. Filter by reply responsibility and try marking a conversation read, important, completed, or archived.

## Try reply routing

1. After connecting, open **Revised proposal needs your approval** and inspect the assessment. Existing demo mailboxes can click **Sync sample inbox** to classify earlier threads.
2. Click **Client preview**, open a conversation, and choose **Ask assistant to take over** or **Mark handled**. In the assistant workspace, find it in **Assistant to Reply** or **Completed** respectively. Client preview is a role simulation within the signed-in demo workspace.
3. Back in the assistant inbox, click **Simulate proposal follow-up** to add a sample resolution to the proposal thread. Automatic classification runs again. Clear any manual assignment to use the latest classification.

Set `OPENAI_API_KEY` in `server/.env` to enable model-based routing and summaries for sample threads. Without a key, or if the model request fails, the UI labels the result as a rule-based assessment. The model receives simulated sample conversations only. The same key enables model-based inbox Q&A and reply generation. The demo also supports rule-based inbox matches and reply templates.

## Ask questions and draft a reply

- Use **Ask your inbox** to ask about active conversations. Open a supporting thread directly from the answer.
- Open a conversation and choose **Generate draft** or write your own. Edit the text, choose **Review draft**, then **Approve and save draft**. The draft stays with the conversation after refresh. Demo mailboxes save drafts in Relay without sending email.

## Deploy on Render

The repository includes a Render Blueprint (`render.yaml`) for a single Node web service. Express serves the built React app and API together. The service checks MongoDB connectivity at `/api/health`.

1. In the [Render dashboard](https://dashboard.render.com/), create a **Blueprint** from this repository.
2. Supply `MONGODB_URI` using a MongoDB deployment reachable from Render. For Atlas, configure the database user's permissions and allow the web service's outbound addresses in Atlas before deploying.
3. Optionally set `OPENAI_API_KEY` in the service environment to enable model-based features. Without it, the demo uses rules and templates.
4. Open the assigned HTTPS URL. Confirm `/api/health` returns `{"status":"ok"}`, then sign up with test credentials and connect a demo mailbox.
