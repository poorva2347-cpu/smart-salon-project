/* ─────────────────────────────────────────
   ADMIN UTILS — helper layer
   Auth headers, safe fetch, ACTION-line parsing,
   entity name→id resolution. No UI. No prompts.
───────────────────────────────────────── */

function getAdminAuthToken() {
  return localStorage.getItem('admin_token') || '';
}

function adminAuthHeaders() {
  return { 'Authorization': 'Bearer ' + getAdminAuthToken() };
}

/** GET + auth header, returns parsed data on success or null on any failure. */
async function adminSafeJsonFetch(url) {
  try {
    var res = await fetch(url, { headers: adminAuthHeaders() });
    if (!res.ok) return null;
    var data = await res.json();
    return (data && data.success) ? data : null;
  } catch (err) {
    return null;
  }
}

/**
 * Parses a trailing "ACTION: type=x; target=y; id=z" line the AI appends
 * for navigation/modal intents. Returns null if no such line is present.
 */
function parseAdminActionLine(text) {
  var match = String(text).match(/ACTION:\s*(.+)\s*$/im);
  if (!match) return null;

  var fields = {};
  match[1].split(';').forEach(function(pair) {
    var eq = pair.indexOf('=');
    if (eq === -1) return;
    var key = pair.slice(0, eq).trim().toLowerCase();
    var val = pair.slice(eq + 1).trim();
    if (key) fields[key] = val;
  });

  if (!fields.type) return null;
  return { type: fields.type, target: fields.target || null, id: fields.id || null };
}

/** Removes the machine-readable ACTION line — the admin must never see it. */
function stripAdminActionLine(text) {
  return String(text).replace(/\n?\s*ACTION:\s*.+$/im, '').trim();
}

/**
 * Resolves an AI-supplied id/name against an already-loaded admin.js list
 * (e.g. the in-memory `barbers` or `services` arrays). Accepts a numeric id
 * as-is, or does a case-insensitive name match against common field shapes.
 * Read-only lookup — never mutates, never calls admin.js CRUD functions.
 */
function adminResolveEntityId(list, idOrName) {
  if (!idOrName) return null;
  if (!isNaN(Number(idOrName))) return Number(idOrName);
  if (!Array.isArray(list)) return null;

  var needle = String(idOrName).trim().toLowerCase();
  var match = list.find(function(item) {
    var name = (item.name || item.barber_name || item.service_name || '').toLowerCase();
    return name === needle || name.indexOf(needle) !== -1;
  });
  if (!match) return null;
  return match.id || match.barber_id || match.service_id || null;
}

/** Formats a "YYYY-MM-DD" (or ISO datetime) string as "1 Jul 2026". Returns null if unparseable. */
function adminFormatDate(dateStr) {
  if (!dateStr) return null;
  var d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Formats a "HH:MM[:SS]" time string as "7:00 PM". Returns null if unparseable. */
function adminFormatTime(timeStr) {
  if (!timeStr) return null;
  var parts = String(timeStr).split(':');
  var h = parseInt(parts[0], 10);
  if (isNaN(h)) return null;
  var m    = parts[1] || '00';
  var pd   = h >= 12 ? 'PM' : 'AM';
  var h12  = h % 12 || 12;
  return h12 + ':' + m + ' ' + pd;
}
