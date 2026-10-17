/* ─────────────────────────────────────────
   10. CHAT — floating AI assistant
───────────────────────────────────────── */
let chatOpen = false;
let chatHistory = [];

function toggleChat() {
  chatOpen = !chatOpen;
  const popup  = document.getElementById('chat-popup');
  const fabIcon = document.getElementById('fab-icon');

  if (!popup || !fabIcon) return;

  popup.classList.toggle('open', chatOpen);
  fabIcon.className = chatOpen ? 'fa fa-times' : 'fa fa-comment-dots';
}

function sendMsg() {
  const inp = document.getElementById('chat-input');
  if (!inp) return;

  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';

  appendMsg('user', text);
  showTyping(text);
}

async function showTyping(userText) {
  const body     = document.getElementById('chat-body');
  const typingId = 'typing-' + Date.now();
  const tdiv     = document.createElement('div');

  tdiv.className = 'msg bot';
  tdiv.id        = typingId;
  tdiv.innerHTML = `
    <div class="bot-ico"><i class="fa fa-robot"></i></div>
    <div class="bubble">
      <div class="typing">
        <div class="t-dot"></div>
        <div class="t-dot"></div>
        <div class="t-dot"></div>
      </div>
    </div>`;

  body.appendChild(tdiv);
  body.scrollTop = body.scrollHeight;

  const messages = await buildConversationPayload(userText, chatHistory);

  var replyText = null;
  try {
    replyText = await getAIResponse(messages);
  } catch (err) {
    replyText = null;
  }

  const el = document.getElementById(typingId);
  if (el) el.remove();

  // Fallback to buildReply if AI call failed or returned empty
  if (!replyText) {
    const fallback = buildReply(userText.toLowerCase());
    appendMsg('bot', fallback.text);
    chatHistory.push({ role: 'user',      content: userText });
    chatHistory.push({ role: 'assistant', content: fallback.text.replace(/<[^>]+>/g, '') });
    if (fallback.action === 'book') {
      applyBookingFromChat(fallback.data);
      setTimeout(() => {
        toggleChat();
        const conf = document.getElementById('confirmation');
        if (conf) conf.scrollIntoView({ behavior: 'smooth' });
      }, 1100);
    }
    return;
  }

  // Customer never sees the machine-readable BOOKING: line — only the natural reply above it
  appendMsg('bot', stripBookingLine(replyText));
  chatHistory.push({ role: 'user',      content: userText });
  chatHistory.push({ role: 'assistant', content: replyText });

  // Parse BOOKING: line that prompts.js instructs the AI to append
  const bookingFields = parseBookingLine(replyText);
  if (bookingFields) {
    applyBookingFromChat(bookingFields);
    setTimeout(() => {
      toggleChat();
      const conf = document.getElementById('confirmation');
      if (conf) conf.scrollIntoView({ behavior: 'smooth' });
    }, 1100);
  }
}

/** Strip the machine-readable BOOKING: line so customers never see raw parser fields. */
function stripBookingLine(text) {
  return text.replace(/\n?\s*BOOKING:\s*.+$/i, '').trim();
}

/** Parse the BOOKING: line (if present) into { svc, barber, date, time }. Order-independent. */
function parseBookingLine(text) {
  const lineMatch = text.match(/BOOKING:\s*(.+)/i);
  if (!lineMatch) return null;

  const fields = {};
  lineMatch[1].split(',').forEach(pair => {
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const key = pair.slice(0, eq).trim().toLowerCase();
    const val = pair.slice(eq + 1).trim();
    if (key) fields[key] = val;
  });

  if (!fields.service || !fields.barber || !fields.time) return null;

  return { svc: fields.service, barber: fields.barber, date: fields.date, time: fields.time };
}

/** Append a chat bubble. Newlines are converted to <br> — the .bubble CSS has no
 *  white-space:pre-line, so raw "\n" from the AI would otherwise collapse to a
 *  single inline run instead of a vertical list. */
function appendMsg(role, html) {
  const body = document.getElementById('chat-body');
  if (!body) return;

  const formatted = String(html).replace(/\n/g, '<br>');

  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.innerHTML = role === 'bot'
    ? `<div class="bot-ico"><i class="fa fa-robot"></i></div><div class="bubble">${formatted}</div>`
    : `<div class="bubble">${formatted}</div>`;

  body.appendChild(d);
  body.scrollTop = body.scrollHeight;
}

/**
 * Simple NLP reply builder — last-resort fallback used only when the AI
 * backend is unreachable. Reads barbers/services from the same live globals
 * (APPT_BARBERS, servicePrices) that script.js keeps synced from the
 * database, so it never asserts stale hardcoded salon facts.
 */
function buildReply(t) {
  const barberNames  = (typeof APPT_BARBERS !== 'undefined') ? APPT_BARBERS : [];
  const serviceNames = (typeof servicePrices !== 'undefined') ? Object.keys(servicePrices) : [];

  // Match a service name against the user's text via short word-prefixes,
  // so "shave" still matches "Shaving" without a hardcoded synonym table.
  const matchesService = name => name.toLowerCase().split(/\s+/).some(word => {
    const token = word.length >= 4 ? word.slice(0, 4) : word;
    return t.includes(token);
  });

  const isBooking = ['book', 'appointment'].some(k => t.includes(k)) || serviceNames.some(matchesService);

  if (isBooking) {
    // Detect barber by first-name token
    const barber = barberNames.find(name => t.includes(name.toLowerCase().split(/\s+/)[0])) || barberNames[0] || 'our team';

    // Detect services — collect all matches, join with " + "
    const svcMatches = serviceNames.filter(matchesService);
    const svc = svcMatches.length > 0 ? [...new Set(svcMatches)].join(' + ') : (serviceNames[0] || 'your selected service');

    // Detect time — colon/dot separator, am/pm, and 24h (e.g. "4pm", "4.30 PM", "16:00")
    const timeRaw = t.match(/\b\d{1,2}[:.]\d{2}\s*[ap]m\b|\b\d{1,2}\s*[ap]m\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/i);
    let time = normalizeTime('4:00 PM');
    if (timeRaw) time = normalizeTime(timeRaw[0].trim());

    return {
      text: `✅ Got it! I've set up a <strong>${svc}</strong> with <strong>${barber}</strong> at <strong>${time}</strong>.<br>Taking you to confirmation…`,
      action: 'book',
      data: { svc, barber, time }
    };
  }

  if (/price|cost|how much|rate/.test(t)) {
    const priceLine = serviceNames.length
      ? serviceNames.map(name => `${name} ₹${servicePrices[name]}`).join(' · ')
      : 'Pricing is temporarily unavailable';
    return { text: `💰 ${priceLine}.<br>Which would you like?` };
  }

  if (/available|slot|timing|when/.test(t)) {
    return { text: '📅 Tell me your preferred time and I\'ll check what\'s open for you.' };
  }

  if (/hi|hello|hey/.test(t)) {
    const example = barberNames[0] || 'our barber';
    return { text: `Hello! 👋 How can I help you today?<br>Try: <em>"Book 4pm haircut with ${example}"</em>` };
  }

  return { text: 'I can help you book an appointment.<br>Try: <em>"Book 3pm beard with our team"</em> or ask about prices.' };
}

/**
 * Converts any reasonable time expression into canonical Smart Salon format "H:MM AM/PM".
 *
 * Rules:
 *  - "noon" / "midday"          → "12:00 PM"
 *  - "midnight"                 → "12:00 AM"
 *  - 24-hour "16:00" / "18:30" → "4:00 PM" / "6:30 PM"
 *  - 12-hour "4pm" / "4 PM"    → "4:00 PM"
 *  - 12-hour "4:30pm"          → "4:30 PM"
 *  - 12-hour "4.30 PM"         → "4:30 PM"
 *  - Leading zero "04:00 AM"   → "4:00 AM"
 *  - Unrecognized input         → returned unchanged
 */
function normalizeTime(input) {
  if (!input) return '';
  const s     = String(input).trim();
  const lower = s.toLowerCase();

  if (lower === 'noon' || lower === 'midday') return '12:00 PM';
  if (lower === 'midnight')                   return '12:00 AM';

  // 24-hour: strict "HH:MM" with no am/pm (e.g. "16:00", "09:30")
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = h24[2];
    if (h >= 0 && h <= 23) {
      const period  = h >= 12 ? 'PM' : 'AM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${display}:${m} ${period}`;
    }
  }

  // 12-hour with optional colon/dot separator + am/pm
  // Covers: "4pm", "4 PM", "04:30 AM", "4.30pm", "12 am"
  const h12 = s.match(/^(\d{1,2})(?:[:\.](\d{2}))?\s*(am|pm)$/i);
  if (h12) {
    const h      = parseInt(h12[1], 10);
    const m      = h12[2] || '00';
    const period = h12[3].toUpperCase();
    const display = h === 0 ? 12 : h;
    return `${display}:${m} ${period}`;
  }

  return s; // unrecognized — pass through so the caller can handle or display as-is
}

/** Resolve a service string (possibly multi-service) into an array of known service names. */
function resolveServiceNames(svcStr) {
  if (!svcStr) return [];
  const tokens = svcStr.split(/\s*\+\s*|\s+and\s+|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
  return tokens.map(token => {
    const tLow = token.toLowerCase();
    return APPT_SERVICE_NAMES.find(n => n.toLowerCase() === tLow)
      || APPT_SERVICE_NAMES.find(n => n.toLowerCase().startsWith(tLow) || tLow.startsWith(n.toLowerCase()))
      || null;
  }).filter(Boolean);
}

/**
 * Resolve the AI's date field into a real Date.
 *  - "today"            → today
 *  - "tomorrow"          → tomorrow
 *  - "YYYY-MM-DD"        → that exact date
 *  - missing/unrecognized → tomorrow (same safe default used when the AI gives no date at all)
 */
function resolveBookingDate(dateStr) {
  const norm = String(dateStr || '').trim().toLowerCase();

  if (norm === 'today') return new Date();

  const explicit = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (explicit) {
    const d = new Date(norm + 'T00:00:00');
    if (!isNaN(d)) return d;
  }

  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Apply booking from AI chat into the confirmation card. */
function applyBookingFromChat({ svc, barber, time, date }) {
  time = normalizeTime(time);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  const svcNames   = resolveServiceNames(svc);
  const totalAmt   = svcNames.reduce((sum, name) => sum + (servicePrices[name] || 0), 0);
  const svcDisplay = svcNames.length > 0 ? svcNames.join(' + ') : (svc || '—');

  set('cr-service', svcDisplay);
  set('cr-barber',  barber);
  set('cr-time',    time);
  set('cr-total',   totalAmt > 0 ? '₹' + totalAmt : '—');

  const bookingDate    = resolveBookingDate(date);
  const bookingDateISO = bookingDate.toISOString().split('T')[0];
  const dateEl = document.getElementById('cr-date');
  if (dateEl) {
    dateEl.textContent = bookingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    dateEl.dataset.iso = bookingDateISO;
  }

  // Sync in-memory state so doConfirm() and openModal() read the AI's selection
  selectedServices = svcNames.map(name => ({ name, price: '₹' + (servicePrices[name] || 0) }));
  currentBarber    = barber || '';

  // Reset success state
  const confMain = document.getElementById('conf-main');
  const success  = document.getElementById('conf-success');
  if (confMain) confMain.style.display = '';
  if (success)  success.classList.remove('show');
}
