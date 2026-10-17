/* ─────────────────────────────────────────
   ADMIN CHATBOT — UI layer
   Open/close, message rendering, typing indicator,
   input handling, history, scrolling.
   No business logic — delegates to adminRouter.
───────────────────────────────────────── */

var adminAIChatOpen    = false;
var adminAIChatHistory = [];  // [{ role, content }, ...]

function toggleAdminAI() {
  adminAIChatOpen  = !adminAIChatOpen;
  var popup = document.getElementById('adm-chat-popup');
  if (popup) popup.classList.toggle('open', adminAIChatOpen);
}

function sendAdminAIMsg() {
  var input = document.getElementById('adm-chat-input');
  if (!input) return;

  var text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendAdminAIMsg('user', text);
  runAdminAITurn(text);
}

async function runAdminAITurn(userText) {
  var typingId = showAdminAITyping();

  var result;
  try {
    result = await routeAdminMessage(userText, adminAIChatHistory);
  } catch (err) {
    result = { display: "I couldn't understand that request.", historyContent: "I couldn't understand that request." };
  }

  removeAdminAITyping(typingId);
  appendAdminAIMsg('bot', result.display);

  // historyContent (the raw model output, ACTION line included) is stored here — not result.display —
  // so the model's own next-turn context shows it truthfully emitted an ACTION line last time.
  // Storing the sanitized display text instead teaches the model, via imitation, to drop the ACTION
  // line on later requests (see adminRouter.js's routeAdminMessage doc comment).
  adminAIChatHistory.push({ role: 'user',      content: userText });
  adminAIChatHistory.push({ role: 'assistant', content: result.historyContent });
  trimAdminAIHistory();
}

function showAdminAITyping() {
  var body = document.getElementById('adm-chat-body');
  if (!body) return null;

  var id  = 'adm-ai-typing-' + Date.now();
  var div = document.createElement('div');
  div.className = 'adm-msg bot';
  div.id = id;
  div.innerHTML =
    '<div class="adm-bot-ico"><i class="fa fa-robot"></i></div>' +
    '<div class="adm-bubble"><i class="fa fa-spinner fa-spin"></i> Typing…</div>';

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  return id;
}

function removeAdminAITyping(id) {
  if (!id) return;
  var el = document.getElementById(id);
  if (el) el.remove();
}

function appendAdminAIMsg(role, text) {
  var body = document.getElementById('adm-chat-body');
  if (!body) return;

  var safe = (typeof escapeHtml === 'function' ? escapeHtml(String(text)) : String(text))
    .replace(/\n/g, '<br>');

  var div = document.createElement('div');
  div.className = 'adm-msg ' + role;
  div.innerHTML = role === 'bot'
    ? '<div class="adm-bot-ico"><i class="fa fa-robot"></i></div><div class="adm-bubble">' + safe + '</div>'
    : '<div class="adm-bubble">' + safe + '</div>';

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function trimAdminAIHistory() {
  var maxMsgs = (ADMIN_AI_CONFIG.maxHistoryTurns || 10) * 2;
  if (adminAIChatHistory.length > maxMsgs) {
    adminAIChatHistory = adminAIChatHistory.slice(adminAIChatHistory.length - maxMsgs);
  }
}
