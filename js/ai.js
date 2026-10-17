/* ─────────────────────────────────────────
   AI — transport layer
   Exposes: getAIResponse(messages)
───────────────────────────────────────── */

var BACKEND_URL = 'http://localhost:3000/chat';

async function getAIResponse(messages) {
  try {
    var response = await fetch(BACKEND_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: messages })
    });

    if (!response.ok) {
      return 'Sorry, the AI service returned an error (' + response.status + '). Please try again.';
    }

    var data = await response.json();

    if (!data.reply) {
      return 'Received an unexpected response from the AI. Please try again.';
    }

    return data.reply;

  } catch (err) {
    return 'Could not reach the backend. Make sure the server is running on port 3000.';
  }
}
