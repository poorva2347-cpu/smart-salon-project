/* ─────────────────────────────────────────
   ADMIN AI — transport layer
   Exposes: sendAdminAIRequest(messages)
   Sends/receives from the backend only.
   No UI. No DOM. No navigation. No business logic.
   Reuses the SAME POST /chat endpoint as the customer AI (js/ai.js) —
   the OpenRouter key stays server-side in backend/.env either way.
───────────────────────────────────────── */

async function sendAdminAIRequest(messages) {
  try {
    var res = await fetch(ADMIN_CHAT_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: messages })
    });

    if (!res.ok) return null;

    var data = await res.json();
    return data.reply || null;

  } catch (err) {
    return null;
  }
}
