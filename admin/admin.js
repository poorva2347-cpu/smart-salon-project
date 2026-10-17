/* ══════════════════════════════════════════
   SMART SALON — ADMIN DASHBOARD JS
   Navigation · Status Toggle · Filter · Chat
══════════════════════════════════════════ */

const API_BASE = 'http://localhost:3000';

// ── Session Guard ────────────────────────
// Synchronous check: redirect immediately if no token present
(function() {
  if (!localStorage.getItem('admin_token')) {
    window.location.replace('login.html');
  }
})();

// Async check: redirect if token is invalid or expired
(function validateAdminToken() {
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  fetch(API_BASE + '/api/admin/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(res) {
    if (!res.ok) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_info');
      window.location.replace('login.html');
    }
  }).catch(function() {});
})();

// ── Section Navigation ──────────────────
function switchSection(sectionId) {
  document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.adm-nav-item').forEach(btn => btn.classList.remove('active'));

  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');

  const navBtn = document.querySelector(`.adm-nav-item[data-section="${sectionId}"]`);
  if (navBtn) navBtn.classList.add('active');

  localStorage.setItem('adm_active_section', sectionId);

  if (sectionId === 'notifications-section') loadNotifications();
  if (sectionId === 'barbers-section')       loadBarbers();
  if (sectionId === 'dashboard-section')     loadDashboard();
  if (sectionId === 'services-section')      loadServices();
  if (sectionId === 'appointments-section')  loadAppointments();
  if (sectionId === 'settings-section')      loadAdminSettings();
}

// Wire sidebar nav items
document.querySelectorAll('.adm-nav-item[data-section]').forEach(btn => {
  btn.addEventListener('click', () => switchSection(btn.dataset.section));
});


// ── Salon Status Toggle ──────────────────
const statusToggle = document.getElementById('salon-status-toggle');
const statusBadge  = document.getElementById('adm-status-badge');
const statusDot    = document.getElementById('adm-status-dot');
const statusText   = document.getElementById('adm-status-text');
const dashDot      = document.getElementById('dash-dot');
const dashText     = document.getElementById('dash-salon-text');

statusToggle.addEventListener('change', () => {
  const isOpen = statusToggle.checked;

  if (isOpen) {
    statusDot.className  = 'adm-status-dot open';
    statusText.textContent = 'Salon Open';
    if (dashDot)  dashDot.className = 'adm-status-dot open';
    if (dashText) dashText.textContent = 'Salon Open';
  } else {
    statusDot.className  = 'adm-status-dot closed';
    statusText.textContent = 'Salon Closed';
    if (dashDot)  dashDot.className = 'adm-status-dot closed';
    if (dashText) dashText.textContent = 'Salon Closed';
  }
});

// ── Appointments — state ─────────────────
var appointments       = [];
var _apptSearchTimeout = null;

// ── Appointments — load from API ─────────
function loadAppointments() {
  var search  = (document.getElementById('appt-search')?.value  || '').trim();
  var status  = document.getElementById('appt-filter')?.value   || 'all';
  var sort    = document.getElementById('appt-sort')?.value     || 'newest';
  var token   = localStorage.getItem('admin_token');

  var params = new URLSearchParams();
  if (search)           params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (sort)             params.set('sort',   sort);

  var tbody   = document.getElementById('appt-tbody');
  var emptyEl = document.getElementById('appt-empty');
  if (tbody)   tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--adm-text-mid)"><i class="fa fa-spinner fa-spin" style="margin-right:8px"></i>Loading…</td></tr>';
  if (emptyEl) emptyEl.style.display = 'none';

  fetch(API_BASE + '/api/admin/appointments?' + params.toString(), {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (!data.success) {
      showToast('Could not load appointments.', 'error');
      if (tbody) tbody.innerHTML = '';
      return;
    }
    appointments = data.appointments;
    renderAppointmentsTable();
  })
  .catch(function() {
    showToast('Failed to load appointments. Please try again.', 'error');
    if (tbody) tbody.innerHTML = '';
  });
}

function renderAppointmentsTable() {
  var tbody   = document.getElementById('appt-tbody');
  var emptyEl = document.getElementById('appt-empty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (appointments.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  appointments.forEach(function(a) { tbody.appendChild(_createAppointmentRow(a)); });
}

function _createAppointmentRow(a) {
  var initials = (a.customer_name || '?').trim().split(/\s+/).map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  var tr = document.createElement('tr');
  tr.dataset.id = a.appointment_id;
  tr.innerHTML =
    '<td>' +
      '<div class="adm-cust-cell">' +
        '<div class="adm-cust-av">' + escapeHtml(initials) + '</div>' +
        '<div>' +
          '<div>' + escapeHtml(a.customer_name || 'Unknown') + '</div>' +
          '<div class="adm-cell-sub">#' + a.appointment_id + '</div>' +
        '</div>' +
      '</div>' +
    '</td>' +
    '<td>' + escapeHtml(a.services || '—') + '</td>' +
    '<td>' + escapeHtml(a.barber_name || 'Unassigned') + '</td>' +
    '<td>' + _fmtApptDate(a.appointment_date) + '</td>' +
    '<td>' + _fmtApptTime(a.appointment_time) + '</td>' +
    '<td><span class="adm-badge ' + a.status + '">' + escapeHtml(_apptStatusLabel(a.status)) + '</span></td>' +
    '<td class="adm-cell-sub">' + _fmtApptCreated(a.created_at) + '</td>' +
    '<td><div class="adm-act-wrap">' +
      '<button class="adm-act-btn adm-btn-view" title="View Details"><i class="fa fa-eye"></i> View</button>' +
    '</div></td>';
  return tr;
}

function _fmtApptDate(s) {
  if (!s) return '—';
  var d = new Date(String(s) + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _fmtApptTime(s) {
  if (!s) return '—';
  var parts = String(s).split(':');
  var h   = parseInt(parts[0], 10);
  var m   = parts[1] || '00';
  var pd  = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + pd;
}

function _fmtApptCreated(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _apptStatusLabel(status) {
  var map = {
    confirmed:           'Confirmed',
    completed:           'Completed',
    cancelled:           'Cancelled',
    pending:             'Pending',
    pending_approval:    'Pending',
    no_show:             'No Show',
    reschedule_proposed: 'Rescheduled',
    rejected:            'Rejected'
  };
  return map[status] || (String(status).charAt(0).toUpperCase() + String(status).slice(1).replace(/_/g, ' '));
}

function viewAppointmentDetails(id) {
  var a = appointments.find(function(appt) { return appt.appointment_id === id; });
  if (!a) return;
  var body = document.getElementById('appt-detail-body');
  if (!body) return;
  body.innerHTML =
    '<div class="adm-detail-grid">' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Appointment ID</div><div class="adm-detail-val">#' + a.appointment_id + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Status</div><div class="adm-detail-val"><span class="adm-badge ' + a.status + '">' + escapeHtml(_apptStatusLabel(a.status)) + '</span></div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Customer</div><div class="adm-detail-val">' + escapeHtml(a.customer_name || 'Unknown') + (a.customer_phone ? '<div class="adm-cell-sub">' + escapeHtml(a.customer_phone) + '</div>' : '') + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Barber</div><div class="adm-detail-val">' + escapeHtml(a.barber_name || 'Unassigned') + '</div></div>' +
      '<div class="adm-detail-item adm-detail-full"><div class="adm-detail-label">Service(s)</div><div class="adm-detail-val">' + escapeHtml(a.services || '—') + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Date</div><div class="adm-detail-val">' + _fmtApptDate(a.appointment_date) + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Time</div><div class="adm-detail-val">' + _fmtApptTime(a.appointment_time) + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Amount</div><div class="adm-detail-val adm-amount">₹' + parseFloat(a.total_amount || 0).toFixed(2) + '</div></div>' +
      '<div class="adm-detail-item"><div class="adm-detail-label">Booked On</div><div class="adm-detail-val">' + _fmtApptCreated(a.created_at) + '</div></div>' +
      (a.customer_notes ? '<div class="adm-detail-item adm-detail-full"><div class="adm-detail-label">Customer Notes</div><div class="adm-detail-val">' + escapeHtml(a.customer_notes) + '</div></div>' : '') +
    '</div>';
  openAdmModal('modal-appt-detail');
}

function _onApptSearch() {
  clearTimeout(_apptSearchTimeout);
  _apptSearchTimeout = setTimeout(loadAppointments, 380);
}

// ── Notifications ────────────────────────
function refreshNotifCount() {
  var token = localStorage.getItem('admin_token');
  fetch(API_BASE + '/api/admin/notifications/count', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var count = data.count || 0;
    var bell  = document.getElementById('adm-notif-count');
    var nav   = document.getElementById('adm-sidebar-notif-badge');
    if (bell) { bell.textContent  = count; bell.style.display  = count > 0 ? '' : 'none'; }
    if (nav)  { nav.textContent   = count; nav.style.display   = count > 0 ? '' : 'none'; }
  })
  .catch(function() {});
}

function loadNotifications() {
  var token = localStorage.getItem('admin_token');
  var feed  = document.getElementById('adm-notif-dynamic-feed');
  if (feed) feed.innerHTML = '<div style="padding:40px;text-align:center;color:var(--adm-text-mid)"><i class="fa fa-spinner fa-spin" style="margin-right:8px"></i>Loading…</div>';

  fetch(API_BASE + '/api/admin/notifications?limit=500', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) {
      if (feed) feed.innerHTML = '<div style="padding:40px;text-align:center;color:var(--adm-text-mid)">Could not load notifications.</div>';
      return;
    }
    _renderNotificationFeed(data.notifications);
    refreshNotifCount();
  })
  .catch(function() {
    if (feed) feed.innerHTML = '<div style="padding:40px;text-align:center;color:var(--adm-text-mid)">Failed to load notifications.</div>';
  });
}

function _renderNotificationFeed(notifications) {
  var feed = document.getElementById('adm-notif-dynamic-feed');
  if (!feed) return;
  if (!notifications || !notifications.length) {
    feed.innerHTML =
      '<div style="padding:56px 40px;text-align:center;color:var(--adm-text-mid)">' +
        '<i class="fa fa-bell-slash" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:12px"></i>' +
        '<div style="font-weight:700;color:var(--adm-primary);margin-bottom:4px;font-size:0.97rem">No notifications yet</div>' +
        '<div style="font-size:0.83rem">Activity will appear here as events happen.</div>' +
      '</div>';
    return;
  }

  var now      = new Date();
  var todayMs  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var yestMs   = todayMs - 86400000;
  var week7Ms  = todayMs - 6 * 86400000;
  var groups   = { Today: [], Yesterday: [], 'Last 7 Days': [], Older: [] };
  notifications.forEach(function(n) {
    var d   = new Date(n.created_at);
    var dMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if      (dMs >= todayMs)  groups.Today.push(n);
    else if (dMs >= yestMs)   groups.Yesterday.push(n);
    else if (dMs >= week7Ms)  groups['Last 7 Days'].push(n);
    else                      groups.Older.push(n);
  });

  var labelOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Older'];
  var html = '';
  labelOrder.forEach(function(label, idx) {
    if (!groups[label].length) return;
    var remaining = labelOrder.slice(idx + 1).every(function(l) { return !groups[l].length; });
    html += '<div class="adm-notif-group"' + (remaining ? ' style="border-bottom:none"' : '') + '>';
    html += '<div class="adm-notif-group-label">' + label + '</div>';
    html += '<div class="adm-notif-feed">';
    groups[label].forEach(function(n) { html += _renderNotifItem(n); });
    html += '</div></div>';
  });
  feed.innerHTML = html;
}

function _renderNotifItem(n) {
  var iconMap = {
    'appointment:booked':    { cls: 'adm-ni-received',  ico: 'fa-calendar-plus'  },
    'appointment:completed': { cls: 'adm-ni-confirmed', ico: 'fa-circle-check'   },
    'appointment:cancelled': { cls: 'adm-ni-cancelled', ico: 'fa-calendar-xmark' },
    'customer:registered':   { cls: 'adm-ni-added',     ico: 'fa-user-plus'      },
    'barber:added':          { cls: 'adm-ni-added',     ico: 'fa-user-plus'      },
    'barber:status_changed': { cls: 'adm-ni-updated',   ico: 'fa-pen-to-square'  },
    'barber:deleted':        { cls: 'adm-ni-cancelled', ico: 'fa-user-minus'     },
    'service:added':         { cls: 'adm-ni-added',     ico: 'fa-list-check'     },
    'service:updated':       { cls: 'adm-ni-updated',   ico: 'fa-pen-to-square'  },
    'service:deleted':       { cls: 'adm-ni-cancelled', ico: 'fa-trash'          }
  };
  var key         = (n.type || '') + ':' + (n.sub_type || '');
  var ico         = iconMap[key] || { cls: 'adm-ni-received', ico: 'fa-bell' };
  var unread      = Number(n.is_read) === 0;
  var unreadClass = unread ? ' unread' : '';
  var dotHtml     = unread ? ' <span class="adm-notif-dot"></span>' : '';
  var timeStr     = _fmtActivityTime(n.created_at);
  return '<div class="adm-notif-item' + unreadClass + '">' +
    '<div class="adm-notif-icon-wrap ' + ico.cls + '"><i class="fa ' + ico.ico + '"></i></div>' +
    '<div class="adm-notif-body">' +
      '<div class="adm-notif-title">' + escapeHtml(n.title || '') + dotHtml + '</div>' +
      '<div class="adm-notif-desc">'  + escapeHtml(n.message || '') + '</div>' +
      '<div class="adm-notif-time">'  + timeStr + '</div>' +
    '</div>' +
  '</div>';
}

function markAllAdminRead() {
  var token = localStorage.getItem('admin_token');
  fetch(API_BASE + '/api/admin/notifications/mark-read', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      document.querySelectorAll('#adm-notif-dynamic-feed .adm-notif-item.unread').forEach(function(item) {
        item.classList.remove('unread');
        var dot = item.querySelector('.adm-notif-dot');
        if (dot) dot.remove();
      });
      refreshNotifCount();
    }
  })
  .catch(function() {});
}

// ── AI Chat Toggle ───────────────────────
const chatPopup = document.getElementById('adm-chat-popup');
let   chatOpen  = false;

function toggleAdminChat() {
  chatOpen = !chatOpen;
  if (chatOpen) {
    chatPopup.classList.add('open');
  } else {
    chatPopup.classList.remove('open');
  }
}

function sendAdminMsg() {
  const input  = document.getElementById('adm-chat-input');
  const body   = document.getElementById('adm-chat-body');
  const text   = input.value.trim();
  if (!text) return;

  // User bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'adm-msg user';
  userMsg.innerHTML = `<div class="adm-bubble">${escapeHtml(text)}</div>`;
  body.appendChild(userMsg);
  input.value = '';

  // Bot placeholder response
  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'adm-msg bot';
    botMsg.innerHTML = `
      <div class="adm-bot-ico"><i class="fa fa-robot"></i></div>
      <div class="adm-bubble">This is a UI placeholder. Full AI functionality coming soon!</div>
    `;
    body.appendChild(botMsg);
    body.scrollTop = body.scrollHeight;
  }, 700);

  body.scrollTop = body.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Toast Notifications ──────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('adm-toast-container');
  if (!container) return;
  const icons = { success: 'fa-check', error: 'fa-xmark' };
  const toast = document.createElement('div');
  toast.className = `adm-toast adm-toast-${type}`;
  toast.innerHTML = `<div class="adm-toast-ico"><i class="fa ${icons[type] || 'fa-check'}"></i></div><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('adm-toast-out');
    setTimeout(() => toast.remove(), 320);
  }, 2500);
}

// ── Logout Button ────────────────────────
document.querySelector('.adm-logout-btn')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.href = 'login.html';
  }
});

// ── Admin Modal System ───────────────────
function openAdmModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('closing');
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeAdmModal(id, e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('show', 'closing');
    document.body.style.overflow = '';
  }, 180);
}

// ── Barber Data Store ─────────────────────
let barbers          = [];
let _editingBarberId = null;
let _deleteBarberId  = null;

// ── Service Data Store ────────────────────
let services          = [];
let _editingServiceId = null;
let _deleteServiceId  = null;

// ── Barber avatar resolution — image_url is the single source of truth ──
function resolveBarberPhotoUrl(rawSrc) {
  if (!rawSrc) return null;
  if (/^(https?:\/\/|data:)/.test(rawSrc)) return rawSrc;
  return rawSrc.startsWith('/') ? API_BASE + rawSrc : '../' + rawSrc;
}

function _handleAdminAvatarError(imgEl, initials, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = initials;
  imgEl.replaceWith(div);
}

function _createBarberRow(b) {
  const initials    = b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const statusLabel = { available: 'Available', busy: 'Busy', off: 'Off', active: 'Active', inactive: 'Inactive' }[b.status] || b.status;
  const ratingHtml  = b.rating != null
    ? `<div class="adm-rating-cell"><i class="fa fa-star adm-star-ico"></i><span class="adm-cell-name" style="font-size:0.85rem">${b.rating}</span><span class="adm-cell-sub">(${b.jobs})</span></div>`
    : `<span class="adm-cell-sub" style="font-size:0.75rem;font-style:italic">New</span>`;
  const imgSrc      = resolveBarberPhotoUrl(b.image_url);
  const photoCell   = imgSrc
    ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(b.name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block" onerror="_handleAdminAvatarError(this,'${initials}','adm-tbl-av')">`
    : `<div class="adm-tbl-av">${initials}</div>`;
  const tr = document.createElement('tr');
  tr.dataset.id = b.id;
  tr.innerHTML = `
    <td>${photoCell}</td>
    <td><div class="adm-cell-name">${escapeHtml(b.name)}</div><div class="adm-cell-sub">${escapeHtml(b.email)}</div></td>
    <td><span class="adm-cell-sub">${escapeHtml(b.spec)}</span></td>
    <td>${b.jobs}</td>
    <td>${ratingHtml}</td>
    <td><span class="adm-badge ${b.status}">${statusLabel}</span></td>
    <td><div class="adm-act-wrap">
      <button class="adm-act-btn adm-btn-edit"   title="Edit Barber"><i class="fa fa-pen"></i> Edit</button>
      <button class="adm-act-btn adm-btn-delete"  title="Delete Barber"><i class="fa fa-trash"></i> Delete</button>
    </div></td>
  `;
  return tr;
}

function renderBarbersTable() {
  const tbody = document.getElementById('barbers-tbody');
  const empty = document.getElementById('barbers-empty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (barbers.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  barbers.forEach(b => tbody.appendChild(_createBarberRow(b)));
}

function loadBarbers() {
  var token = localStorage.getItem('admin_token');
  return fetch(API_BASE + '/api/admin/barbers', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (!data.success) {
      showToast('Could not load barbers.', 'error');
      return;
    }
    barbers = data.barbers.map(function(b) {
      return {
        id:        b.barber_id,
        name:      b.barber_name,
        email:     b.email,
        phone:     b.phone  || '',
        spec:      b.specialization   || '',
        exp:       b.experience_years != null ? b.experience_years : 0,
        image_url: b.image_url || null,
        rating:    null,
        jobs:      Number(b.today_jobs || 0),
        status:    b.status
      };
    });
    renderBarbersTable();
  })
  .catch(function() {
    showToast('Failed to load barbers. Please try again.', 'error');
  });
}

function openAddBarber() {
  _editingBarberId = null;
  const btn = document.getElementById('modal-barber-save');
  btn.disabled  = false;
  btn.innerHTML = '<i class="fa fa-check"></i> Save Barber';
  document.getElementById('modal-barber-title').textContent = 'Add Barber';
  ['barber-name','barber-email','barber-phone','barber-spec','barber-exp','barber-password'].forEach(id => {
    document.getElementById(id).value = '';
  });
  const pwInput = document.getElementById('barber-password');
  const pwIco   = document.getElementById('barber-pw-eye-ico');
  if (pwInput) pwInput.type = 'password';
  if (pwIco)   pwIco.className = 'fa fa-eye';
  const pwWrap = document.getElementById('barber-pw-wrap');
  if (pwWrap) pwWrap.style.display = '';
  document.getElementById('barber-status').value = 'active';
  _clearBarberErrors();
  openAdmModal('modal-barber');
}

function openEditBarber(id) {
  var b = barbers.find(function(bar) { return bar.id === id; });
  if (!b) return;
  _editingBarberId = id;

  document.getElementById('modal-barber-title').textContent = 'Edit Barber';
  document.getElementById('barber-name').value   = b.name;
  document.getElementById('barber-email').value  = b.email;
  document.getElementById('barber-phone').value  = b.phone || '';
  document.getElementById('barber-spec').value   = b.spec  || '';
  document.getElementById('barber-exp').value    = b.exp > 0 ? b.exp : '';
  document.getElementById('barber-status').value = b.status;

  var pwWrap = document.getElementById('barber-pw-wrap');
  if (pwWrap) pwWrap.style.display = 'none';

  var btn = document.getElementById('modal-barber-save');
  btn.disabled  = false;
  btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';

  _clearBarberErrors();
  openAdmModal('modal-barber');
}

function _clearBarberErrors() {
  document.querySelectorAll('#modal-barber .adm-finput').forEach(el => el.classList.remove('adm-input-error'));
  document.querySelectorAll('#modal-barber .adm-field-error').forEach(el => el.classList.remove('visible'));
}

function toggleBarberPw() {
  var input = document.getElementById('barber-password');
  var ico   = document.getElementById('barber-pw-eye-ico');
  if (!input) return;
  if (input.type === 'password') {
    input.type    = 'text';
    ico.className = 'fa fa-eye-slash';
  } else {
    input.type    = 'password';
    ico.className = 'fa fa-eye';
  }
}

function _validateBarberForm() {
  let valid = true;
  [
    { inputId: 'barber-name',  errId: 'err-barber-name',  msg: 'Name is required'          },
    { inputId: 'barber-email', errId: 'err-barber-email', msg: 'Email is required'          },
    { inputId: 'barber-phone', errId: 'err-barber-phone', msg: 'Phone is required'          },
    { inputId: 'barber-spec',  errId: 'err-barber-spec',  msg: 'Specialization is required' },
  ].forEach(f => {
    const input = document.getElementById(f.inputId);
    const err   = document.getElementById(f.errId);
    if (!input || !input.value.trim()) {
      if (input) input.classList.add('adm-input-error');
      if (err) { err.textContent = f.msg; err.classList.add('visible'); }
      valid = false;
    } else {
      input.classList.remove('adm-input-error');
      if (err) err.classList.remove('visible');
    }
  });
  if (_editingBarberId === null) {
    const pwInput = document.getElementById('barber-password');
    const pwErr   = document.getElementById('err-barber-password');
    if (!pwInput || !pwInput.value) {
      if (pwInput) pwInput.classList.add('adm-input-error');
      if (pwErr)   { pwErr.textContent = 'Password is required'; pwErr.classList.add('visible'); }
      valid = false;
    } else {
      if (pwInput) pwInput.classList.remove('adm-input-error');
      if (pwErr)   pwErr.classList.remove('visible');
    }
  }
  return valid;
}

function saveBarber() {
  if (!_validateBarberForm()) return;
  const name   = document.getElementById('barber-name').value.trim();
  const email  = document.getElementById('barber-email').value.trim();
  const phone  = document.getElementById('barber-phone').value.trim();
  const spec   = document.getElementById('barber-spec').value.trim();
  const expRaw = document.getElementById('barber-exp').value;
  const expNum = expRaw !== '' ? parseInt(expRaw, 10) : null;
  const status = document.getElementById('barber-status').value;

  if (_editingBarberId !== null) {
    let btn    = document.getElementById('modal-barber-save');
    let editId = _editingBarberId;
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…';

    let token   = localStorage.getItem('admin_token');
    let payload = {
      barber_name:      name,
      email:            email,
      phone:            phone,
      specialization:   spec || null,
      experience_years: expNum,
      status:           status
    };

    fetch(API_BASE + '/api/admin/barbers/' + editId, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify(payload)
    })
    .then(function(res) {
      return res.json().then(function(data) { return { ok: res.ok, httpStatus: res.status, data: data }; });
    })
    .then(function(result) {
      var ok = result.ok, httpStatus = result.httpStatus, data = result.data;
      if (!ok || !data.success) {
        if (httpStatus === 409) {
          var emailInput = document.getElementById('barber-email');
          var emailErr   = document.getElementById('err-barber-email');
          if (emailInput) emailInput.classList.add('adm-input-error');
          if (emailErr)   { emailErr.textContent = data.message || 'Email already in use.'; emailErr.classList.add('visible'); }
        } else {
          showToast(data.message || 'Failed to update barber. Please try again.', 'error');
        }
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';
        return;
      }
      var b   = data.barber;
      var idx = barbers.findIndex(function(bar) { return bar.id === editId; });
      if (idx !== -1) {
        barbers[idx] = { ...barbers[idx], name: b.barber_name, email: b.email, phone: b.phone || '', spec: b.specialization || '', exp: b.experience_years != null ? b.experience_years : 0, status: b.status, image_url: b.image_url || null };
      }
      closeAdmModal('modal-barber');
      setTimeout(function() {
        var existingRow = document.querySelector('#barbers-tbody tr[data-id="' + editId + '"]');
        if (existingRow && idx !== -1) {
          var newRow = _createBarberRow(barbers[idx]);
          newRow.classList.add('adm-row-flash');
          existingRow.parentNode.replaceChild(newRow, existingRow);
        }
        showToast('Barber updated successfully');
      }, 210);
    })
    .catch(function() {
      showToast('Cannot connect to server. Please try again.', 'error');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';
    });
    return;
  }

  // Add mode — create barber via API
  const password = document.getElementById('barber-password').value;
  const btn      = document.getElementById('modal-barber-save');
  btn.disabled   = true;
  btn.innerHTML  = '<i class="fa fa-spinner fa-spin"></i> Saving…';

  const token   = localStorage.getItem('admin_token');
  const payload = { barber_name: name, email, phone, password, status };
  if (spec)           payload.specialization   = spec;
  if (expNum != null) payload.experience_years = expNum;

  fetch(API_BASE + '/api/admin/barbers', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body:    JSON.stringify(payload)
  })
  .then(function(res) {
    return res.json().then(function(data) { return { ok: res.ok, httpStatus: res.status, data }; });
  })
  .then(function(result) {
    var ok = result.ok, httpStatus = result.httpStatus, data = result.data;
    if (!ok || !data.success) {
      if (httpStatus === 409) {
        var emailInput = document.getElementById('barber-email');
        var emailErr   = document.getElementById('err-barber-email');
        if (emailInput) emailInput.classList.add('adm-input-error');
        if (emailErr)   { emailErr.textContent = 'This email is already registered.'; emailErr.classList.add('visible'); }
      } else if (httpStatus === 401 || httpStatus === 403) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(function() {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_info');
          window.location.replace('login.html');
        }, 2000);
      } else {
        showToast(data.message || 'Failed to create barber. Please try again.', 'error');
      }
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Save Barber';
      return;
    }

    var b = data.barber;
    var newBarber = {
      id:     b.barber_id,
      name:   b.barber_name,
      email:  b.email,
      phone:  b.phone,
      spec:   b.specialization || '',
      exp:    b.experience_years || 0,
      rating: null,
      jobs:   0,
      status: b.status
    };
    barbers.push(newBarber);
    closeAdmModal('modal-barber');
    setTimeout(function() {
      var tbody = document.getElementById('barbers-tbody');
      var empty = document.getElementById('barbers-empty');
      if (empty) empty.style.display = 'none';
      if (tbody) {
        var row = _createBarberRow(newBarber);
        row.classList.add('adm-row-enter');
        tbody.appendChild(row);
      }
    }, 210);
    showToast('Barber created successfully');
  })
  .catch(function() {
    showToast('Cannot connect to server. Please try again.', 'error');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa fa-check"></i> Save Barber';
  });
}

// ── Delete Barber ─────────────────────────
function confirmDeleteBarber(id) {
  var b = barbers.find(function(bar) { return bar.id === id; });
  if (!b) return;
  _deleteBarberId = id;

  document.getElementById('modal-confirm-title').textContent = 'Delete Barber';
  document.getElementById('modal-confirm-msg').textContent   = 'Are you sure you want to delete "' + b.name + '"?';

  var actionBtn = document.getElementById('modal-confirm-action');
  actionBtn.disabled  = false;
  actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete';
  actionBtn.onclick   = executeDeleteBarber;

  openAdmModal('modal-confirm');
}

function executeDeleteBarber() {
  if (_deleteBarberId === null) return;
  var deleteId  = _deleteBarberId;
  var name      = (barbers.find(function(b) { return b.id === deleteId; }) || {}).name || 'Barber';
  var token     = localStorage.getItem('admin_token');
  var actionBtn = document.getElementById('modal-confirm-action');

  if (actionBtn) {
    actionBtn.disabled  = true;
    actionBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Deleting…';
  }

  fetch(API_BASE + '/api/admin/barbers/' + deleteId, {
    method:  'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) {
    return res.json().then(function(data) { return { ok: res.ok, data: data }; });
  })
  .then(function(result) {
    if (actionBtn) {
      actionBtn.disabled  = false;
      actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete';
    }
    if (!result.ok || !result.data.success) {
      closeAdmModal('modal-confirm');
      showToast(result.data.message || 'Failed to delete barber.', 'error');
      return;
    }
    barbers = barbers.filter(function(b) { return b.id !== deleteId; });
    _deleteBarberId = null;
    closeAdmModal('modal-confirm');
    var row = document.querySelector('#barbers-tbody tr[data-id="' + deleteId + '"]');
    if (row) {
      row.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      row.style.opacity    = '0';
      row.style.transform  = 'translateX(20px)';
      setTimeout(function() {
        row.remove();
        if (barbers.length === 0) {
          var empty = document.getElementById('barbers-empty');
          if (empty) empty.style.display = 'flex';
        }
        showToast(name + ' removed successfully');
      }, 270);
    } else {
      renderBarbersTable();
      showToast(name + ' removed successfully');
    }
  })
  .catch(function() {
    if (actionBtn) {
      actionBtn.disabled  = false;
      actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete';
    }
    showToast('Cannot connect to server. Please try again.', 'error');
  });
}

// ── Services ──────────────────────────────
// Bumped by loadServices() and by every successful create/update/delete so an
// in-flight GET that started before a local mutation can detect it's been
// superseded and discard its (now stale) response instead of overwriting the
// services array with out-of-date data.
let servicesStateVersion = 0;

function loadServices() {
  var token = localStorage.getItem('admin_token');
  var requestVersion = ++servicesStateVersion;
  return fetch(API_BASE + '/api/admin/services', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (requestVersion !== servicesStateVersion) return;
    if (!data.success) { showToast('Could not load services.', 'error'); return; }
    services = data.services;
    renderServicesTable();
  })
  .catch(function() { showToast('Failed to load services. Please try again.', 'error'); });
}

function renderServicesTable() {
  var tbody = document.getElementById('services-tbody');
  var empty = document.getElementById('services-empty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (services.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  services.forEach(function(s) { tbody.appendChild(_createServiceRow(s)); });
}

function _createServiceRow(s) {
  var tr = document.createElement('tr');
  tr.dataset.id = s.service_id;
  tr.innerHTML =
    '<td>' +
      '<div class="adm-cell-name">' + escapeHtml(s.service_name) + '</div>' +
      (s.description ? '<div class="adm-cell-sub">' + escapeHtml(s.description) + '</div>' : '') +
    '</td>' +
    '<td>' + s.duration_minutes + ' min</td>' +
    '<td class="adm-amount">₹' + parseFloat(s.price).toFixed(2) + '</td>' +
    '<td>' + Number(s.booking_count || 0) + '</td>' +
    '<td><span class="adm-badge ' + s.status + '">' + (s.status === 'active' ? 'Active' : 'Inactive') + '</span></td>' +
    '<td><div class="adm-act-wrap">' +
      '<button class="adm-act-btn adm-btn-edit" title="Edit Service"><i class="fa fa-pen"></i> Edit</button>' +
      '<button class="adm-act-btn adm-btn-delete" title="Delete Service"><i class="fa fa-trash"></i> Delete</button>' +
    '</div></td>';
  return tr;
}

function openAddService() {
  _editingServiceId = null;
  document.getElementById('modal-service-title').textContent = 'Add Service';
  document.getElementById('svc-name').value     = '';
  document.getElementById('svc-duration').value = '30';
  document.getElementById('svc-price').value    = '';
  document.getElementById('svc-desc').value     = '';
  document.getElementById('svc-status').value   = 'active';
  var btn = document.getElementById('modal-service-save');
  btn.disabled  = false;
  btn.innerHTML = '<i class="fa fa-check"></i> Save Service';
  _clearServiceErrors();
  openAdmModal('modal-service');
}

function openEditService(id) {
  var s = services.find(function(svc) { return svc.service_id === id; });
  if (!s) return;
  _editingServiceId = id;
  document.getElementById('modal-service-title').textContent = 'Edit Service';
  document.getElementById('svc-name').value     = s.service_name;
  document.getElementById('svc-duration').value = s.duration_minutes;
  document.getElementById('svc-price').value    = parseFloat(s.price);
  document.getElementById('svc-desc').value     = s.description || '';
  document.getElementById('svc-status').value   = s.status;
  var btn = document.getElementById('modal-service-save');
  btn.disabled  = false;
  btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';
  _clearServiceErrors();
  openAdmModal('modal-service');
}

function _clearServiceErrors() {
  document.querySelectorAll('#modal-service .adm-finput').forEach(function(el) { el.classList.remove('adm-input-error'); });
  document.querySelectorAll('#modal-service .adm-field-error').forEach(function(el) { el.classList.remove('visible'); });
}

function _validateServiceForm() {
  var valid = true;
  var nameInput = document.getElementById('svc-name');
  var nameErr   = document.getElementById('err-svc-name');
  if (!nameInput.value.trim()) {
    nameInput.classList.add('adm-input-error');
    nameErr.textContent = 'Service name is required';
    nameErr.classList.add('visible');
    valid = false;
  } else {
    nameInput.classList.remove('adm-input-error');
    nameErr.classList.remove('visible');
  }
  var priceInput = document.getElementById('svc-price');
  var priceErr   = document.getElementById('err-svc-price');
  var priceVal   = parseFloat(priceInput.value);
  if (!priceInput.value || isNaN(priceVal) || priceVal <= 0) {
    priceInput.classList.add('adm-input-error');
    priceErr.textContent = 'Enter a valid price greater than 0';
    priceErr.classList.add('visible');
    valid = false;
  } else {
    priceInput.classList.remove('adm-input-error');
    priceErr.classList.remove('visible');
  }
  return valid;
}

function saveService() {
  if (!_validateServiceForm()) return;
  var name     = document.getElementById('svc-name').value.trim();
  var duration = parseInt(document.getElementById('svc-duration').value, 10);
  var price    = parseFloat(document.getElementById('svc-price').value);
  var desc     = document.getElementById('svc-desc').value.trim();
  var status   = document.getElementById('svc-status').value;
  var btn      = document.getElementById('modal-service-save');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…';
  var token   = localStorage.getItem('admin_token');
  var payload = { service_name: name, duration_minutes: duration, price: price, description: desc || null, status: status };

  if (_editingServiceId !== null) {
    var editId = _editingServiceId;
    fetch(API_BASE + '/api/admin/services/' + editId, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify(payload)
    })
    .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, httpStatus: res.status, data: data }; }); })
    .then(function(result) {
      if (!result.ok || !result.data.success) {
        if (result.httpStatus === 409) {
          var ni = document.getElementById('svc-name');
          var ne = document.getElementById('err-svc-name');
          ni.classList.add('adm-input-error');
          ne.textContent = result.data.message || 'Name already in use.';
          ne.classList.add('visible');
        } else {
          showToast(result.data.message || 'Failed to update service.', 'error');
        }
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';
        return;
      }
      servicesStateVersion++;
      var s   = result.data.service;
      var idx = services.findIndex(function(svc) { return svc.service_id === editId; });
      if (idx !== -1) {
        services[idx] = Object.assign({}, services[idx], {
          service_name: s.service_name, description: s.description,
          price: s.price, duration_minutes: s.duration_minutes, status: s.status
        });
      }
      closeAdmModal('modal-service');
      setTimeout(function() {
        var existingRow = document.querySelector('#services-tbody tr[data-id="' + editId + '"]');
        if (existingRow && idx !== -1) {
          var newRow = _createServiceRow(services[idx]);
          newRow.classList.add('adm-row-flash');
          existingRow.parentNode.replaceChild(newRow, existingRow);
        }
        showToast('Service updated successfully');
      }, 210);
    })
    .catch(function() {
      showToast('Cannot connect to server. Please try again.', 'error');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Save Changes';
    });
    return;
  }

  fetch(API_BASE + '/api/admin/services', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body:    JSON.stringify(payload)
  })
  .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, httpStatus: res.status, data: data }; }); })
  .then(function(result) {
    if (!result.ok || !result.data.success) {
      if (result.httpStatus === 409) {
        var ni = document.getElementById('svc-name');
        var ne = document.getElementById('err-svc-name');
        ni.classList.add('adm-input-error');
        ne.textContent = result.data.message || 'A service with this name already exists.';
        ne.classList.add('visible');
      } else {
        showToast(result.data.message || 'Failed to create service.', 'error');
      }
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Save Service';
      return;
    }
    servicesStateVersion++;
    var s = result.data.service;
    services.push(s);
    closeAdmModal('modal-service');
    setTimeout(function() {
      var tbody = document.getElementById('services-tbody');
      var empty = document.getElementById('services-empty');
      if (empty) empty.style.display = 'none';
      if (tbody) {
        var row = _createServiceRow(s);
        row.classList.add('adm-row-enter');
        tbody.appendChild(row);
      }
    }, 210);
    showToast('Service created successfully');
  })
  .catch(function() {
    showToast('Cannot connect to server. Please try again.', 'error');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa fa-check"></i> Save Service';
  });
}

// ── Delete Service ────────────────────────
function confirmDeleteService(id) {
  var s = services.find(function(svc) { return svc.service_id === id; });
  if (!s) return;
  _deleteServiceId = id;
  document.getElementById('modal-confirm-title').textContent = 'Delete Service';
  document.getElementById('modal-confirm-msg').textContent   = 'Are you sure you want to delete "' + s.service_name + '"?';
  var actionBtn = document.getElementById('modal-confirm-action');
  actionBtn.disabled  = false;
  actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete';
  actionBtn.onclick   = executeDeleteService;
  openAdmModal('modal-confirm');
}

function executeDeleteService() {
  if (_deleteServiceId === null) return;
  var deleteId  = _deleteServiceId;
  var name      = (services.find(function(s) { return s.service_id === deleteId; }) || {}).service_name || 'Service';
  var token     = localStorage.getItem('admin_token');
  var actionBtn = document.getElementById('modal-confirm-action');
  if (actionBtn) { actionBtn.disabled = true; actionBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Deleting…'; }
  fetch(API_BASE + '/api/admin/services/' + deleteId, {
    method:  'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
  .then(function(result) {
    if (actionBtn) { actionBtn.disabled = false; actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete'; }
    if (!result.ok || !result.data.success) {
      closeAdmModal('modal-confirm');
      showToast(result.data.message || 'Failed to delete service.', 'error');
      return;
    }
    servicesStateVersion++;
    services = services.filter(function(s) { return s.service_id !== deleteId; });
    _deleteServiceId = null;
    closeAdmModal('modal-confirm');
    var row = document.querySelector('#services-tbody tr[data-id="' + deleteId + '"]');
    if (row) {
      row.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      row.style.opacity    = '0';
      row.style.transform  = 'translateX(20px)';
      setTimeout(function() {
        row.remove();
        if (services.length === 0) {
          var empty = document.getElementById('services-empty');
          if (empty) empty.style.display = 'flex';
        }
        showToast(name + ' removed successfully');
      }, 270);
    } else {
      renderServicesTable();
      showToast(name + ' removed successfully');
    }
  })
  .catch(function() {
    if (actionBtn) { actionBtn.disabled = false; actionBtn.innerHTML = '<i class="fa fa-trash"></i> Delete'; }
    showToast('Cannot connect to server. Please try again.', 'error');
  });
}

// Escape key closes open modals
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  ['modal-barber', 'modal-service', 'modal-appt-detail', 'modal-confirm', 'modal-change-pw'].forEach(id => {
    if (document.getElementById(id)?.classList.contains('show')) closeAdmModal(id);
  });
});

// ── Appointments view button delegation ───
document.addEventListener('click', function(e) {
  var viewBtn = e.target.closest('#appt-tbody .adm-btn-view');
  if (viewBtn) {
    var row = viewBtn.closest('tr[data-id]');
    if (row) viewAppointmentDetails(parseInt(row.dataset.id, 10));
  }
});

// ── Barber table edit / delete delegation ─
document.addEventListener('click', function(e) {
  var editBtn   = e.target.closest('#barbers-tbody .adm-btn-edit');
  var deleteBtn = e.target.closest('#barbers-tbody .adm-btn-delete');

  if (editBtn) {
    var row = editBtn.closest('tr[data-id]');
    if (row) openEditBarber(parseInt(row.dataset.id, 10));
    return;
  }

  if (deleteBtn) {
    var row = deleteBtn.closest('tr[data-id]');
    if (row) confirmDeleteBarber(parseInt(row.dataset.id, 10));
  }
});

// ── Service table edit / delete delegation ─
document.addEventListener('click', function(e) {
  var editBtn   = e.target.closest('#services-tbody .adm-btn-edit');
  var deleteBtn = e.target.closest('#services-tbody .adm-btn-delete');

  if (editBtn) {
    var row = editBtn.closest('tr[data-id]');
    if (row) openEditService(parseInt(row.dataset.id, 10));
    return;
  }

  if (deleteBtn) {
    var row = deleteBtn.closest('tr[data-id]');
    if (row) confirmDeleteService(parseInt(row.dataset.id, 10));
  }
});

// ── Dashboard ─────────────────────────────
function loadDashboard() {
  var token   = localStorage.getItem('admin_token');
  var headers = { 'Authorization': 'Bearer ' + token };

  Promise.all([
    fetch(API_BASE + '/api/admin/dashboard/stats',        { headers: headers }).then(function(r) { return r.json(); }),
    fetch(API_BASE + '/api/admin/dashboard/charts',       { headers: headers }).then(function(r) { return r.json(); }),
    fetch(API_BASE + '/api/admin/dashboard/top-barbers',  { headers: headers }).then(function(r) { return r.json(); }),
    fetch(API_BASE + '/api/admin/dashboard/activity',     { headers: headers }).then(function(r) { return r.json(); }),
    fetch(API_BASE + '/api/admin/dashboard/top-services', { headers: headers }).then(function(r) { return r.json(); }),
    loadBarbers() // ensures `barbers` (with image_url) is populated before Top Performing Barbers renders
  ]).then(function(results) {
    if (results[0].success) _renderKPIs(results[0].stats);
    if (results[1].success) _renderWeeklyChart(results[1].weekly);
    if (results[2].success) _renderTopBarbers(results[2].barbers);
    _renderActivity(results[3].success  ? (results[3].activity  || []) : []);
    _renderTopServices(results[4].success ? (results[4].services || []) : []);
  }).catch(function() {
    _renderActivity([]);
    _renderTopServices([]);
  });
  refreshNotifCount();
}

function _renderKPIs(stats) {
  var map = {
    'kpi-total-bookings':    stats.total_appointments,
    'kpi-today-appointments': stats.today_appointments,
    'kpi-pending':           stats.pending_appointments,
    'kpi-active-barbers':    stats.active_barbers
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = Number(map[id]).toLocaleString();
  });
}

function _renderWeeklyChart(weeklyArr) {
  var container = document.getElementById('weekly-chart-container');
  if (!container) return;
  var counts  = weeklyArr.map(function(d) { return d.count; });
  var maxCount = Math.max.apply(null, counts) || 1;

  container.innerHTML = weeklyArr.map(function(d) {
    var pct     = Math.round((d.count / maxCount) * 100);
    var barPct  = Math.max(pct, 4);
    var hiClass = pct === 100 ? ' highlight' : '';
    return '<div class="adm-vbar-group">' +
      '<div class="adm-vbar-inner">' +
        '<span class="adm-vbar-val">' + d.count + '</span>' +
        '<div class="adm-vbar-bar' + hiClass + '" style="height:' + barPct + '%"></div>' +
      '</div>' +
      '<span class="adm-vbar-day">' + escapeHtml(d.day) + '</span>' +
    '</div>';
  }).join('');
}

function _renderTopBarbers(barbersArr) {
  var container = document.getElementById('top-barbers-list');
  if (!container) return;
  if (!barbersArr.length) {
    container.innerHTML = '<p class="adm-cell-sub" style="padding:16px;font-style:italic">No data yet.</p>';
    return;
  }
  container.innerHTML = barbersArr.map(function(b) {
    var initials = b.barber_name.split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
    var spec     = b.specialization || 'General';
    var jobs     = Number(b.total_jobs);
    var full     = barbers.find(function(x) { return x.id === b.barber_id; });
    var imgSrc   = full ? resolveBarberPhotoUrl(full.image_url) : null;
    var avatarHtml = imgSrc
      ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(b.barber_name) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0" onerror="_handleAdminAvatarError(this,\'' + initials + '\',\'adm-dash-avatar\')">'
      : '<div class="adm-dash-avatar">' + initials + '</div>';
    return '<div class="adm-barber-row">' +
      avatarHtml +
      '<div class="adm-barber-info">' +
        '<div class="adm-barber-name">' + escapeHtml(b.barber_name) + '</div>' +
        '<div class="adm-barber-spec">' + escapeHtml(spec) + '</div>' +
      '</div>' +
      '<div class="adm-barber-stats">' +
        '<div class="adm-stat-rating"><i class="fa fa-circle-check" style="color:var(--adm-success,#22c55e)"></i></div>' +
        '<div class="adm-stat-sub">' + jobs + ' job' + (jobs !== 1 ? 's' : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _renderActivity(activityArr) {
  var container = document.getElementById('recent-activity-list');
  if (!container) return;
  if (!activityArr || !activityArr.length) {
    container.innerHTML = '<p class="adm-cell-sub" style="padding:16px 22px;font-style:italic">No recent activity.</p>';
    return;
  }
  activityArr = activityArr.slice(0, 5);

  var dotMap = {
    'appointment:booked':    'adm-dot-booked',
    'appointment:completed': 'adm-dot-confirmed',
    'appointment:cancelled': 'adm-dot-cancelled',
    'customer:registered':   'adm-dot-added',
    'barber:added':          'adm-dot-added',
    'barber:status_changed': 'adm-dot-updated',
    'barber:deleted':        'adm-dot-cancelled',
    'service:added':         'adm-dot-added',
    'service:updated':       'adm-dot-updated',
    'service:deleted':       'adm-dot-cancelled'
  };

  container.innerHTML = activityArr.map(function(item) {
    var key     = (item.type || '') + ':' + (item.sub_type || '');
    var dot     = dotMap[key] || 'adm-dot-booked';
    var timeStr = _fmtActivityTime(item.created_at);
    return '<div class="adm-activity-item">' +
      '<div class="adm-activity-dot ' + dot + '"></div>' +
      '<div class="adm-activity-content">' +
        '<div class="adm-activity-title">' + escapeHtml(item.title || '') + '</div>' +
        '<div class="adm-activity-sub">'   + escapeHtml(item.message || '') + '</div>' +
      '</div>' +
      '<span class="adm-activity-time">' + timeStr + '</span>' +
    '</div>';
  }).join('');
}

function _renderTopServices(servicesArr) {
  var container = document.getElementById('top-services-chart');
  if (!container) return;
  if (!servicesArr || !servicesArr.length) {
    container.innerHTML = '<p class="adm-cell-sub" style="padding:16px;font-style:italic">No data yet.</p>';
    return;
  }
  var maxCount = Math.max.apply(null, servicesArr.map(function(s) { return Number(s.booking_count); })) || 1;
  container.innerHTML = servicesArr.map(function(s) {
    var count  = Number(s.booking_count);
    var barPct = Math.max(Math.round((count / maxCount) * 100), 4);
    return '<div class="adm-hbar-row">' +
      '<span class="adm-hbar-label">' + escapeHtml(s.service_name) + '</span>' +
      '<div class="adm-hbar-track"><div class="adm-hbar-fill" style="width:' + barPct + '%"></div></div>' +
      '<span class="adm-hbar-val">' + count + '</span>' +
    '</div>';
  }).join('');
}

function _fmtActivityTime(isoStr) {
  if (!isoStr) return '';
  var d       = new Date(isoStr);
  var diffMs  = Date.now() - d.getTime();
  var diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return diffMin + 'm ago';
  var diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return diffHr + 'h ago';
  var diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)  return diffDay + 'd ago';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Initial Render ───────────────────────
(function() {
  refreshNotifCount();
  var stored = JSON.parse(localStorage.getItem('admin_info') || '{}');
  if (stored.full_name) _updateNavAdminDisplay(stored.full_name);
  var saved = localStorage.getItem('adm_active_section');
  if (saved && document.getElementById(saved)) {
    switchSection(saved);
  } else {
    switchSection('dashboard-section');
  }
})();

// ── Admin Profile Helpers ─────────────────
function _updateNavAdminDisplay(name) {
  var el  = document.getElementById('adm-nav-name');
  var av  = document.getElementById('adm-nav-avatar');
  if (el) el.textContent = name || 'Admin';
  if (av) {
    av.textContent = (name || 'Admin').trim().split(/\s+/)
      .map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'AD';
  }
}

// ── Admin Settings ────────────────────────
function loadAdminSettings() {
  var token = localStorage.getItem('admin_token');
  fetch(API_BASE + '/api/admin/profile', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) return;
    var nameEl  = document.getElementById('settings-admin-name');
    var emailEl = document.getElementById('settings-admin-email');
    if (nameEl)  nameEl.value  = data.admin.full_name || '';
    if (emailEl) emailEl.value = data.admin.email     || '';
    _updateNavAdminDisplay(data.admin.full_name);
    var stored = JSON.parse(localStorage.getItem('admin_info') || '{}');
    stored.full_name = data.admin.full_name;
    stored.email     = data.admin.email;
    localStorage.setItem('admin_info', JSON.stringify(stored));
  })
  .catch(function() {});
}

function _clearSettingsProfileErrors() {
  ['settings-admin-name', 'settings-admin-email'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('adm-input-error');
  });
  ['err-settings-name', 'err-settings-email'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });
}

function saveAdminProfile() {
  _clearSettingsProfileErrors();
  var nameEl  = document.getElementById('settings-admin-name');
  var emailEl = document.getElementById('settings-admin-email');
  var name    = (nameEl  ? nameEl.value.trim()  : '');
  var email   = (emailEl ? emailEl.value.trim() : '');
  var valid   = true;

  if (!name) {
    if (nameEl) nameEl.classList.add('adm-input-error');
    var ne = document.getElementById('err-settings-name');
    if (ne) { ne.textContent = 'Name is required.'; ne.classList.add('visible'); }
    valid = false;
  }
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    if (emailEl) emailEl.classList.add('adm-input-error');
    var ee = document.getElementById('err-settings-email');
    if (ee) { ee.textContent = email ? 'Invalid email format.' : 'Email is required.'; ee.classList.add('visible'); }
    valid = false;
  }
  if (!valid) return;

  var btn   = document.getElementById('settings-profile-btn');
  var token = localStorage.getItem('admin_token');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…'; }

  fetch(API_BASE + '/api/admin/profile', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body:    JSON.stringify({ full_name: name, email: email })
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
  .then(function(result) {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Save Account Details'; }
    if (!result.ok || !result.data.success) {
      if (result.status === 409) {
        if (emailEl) emailEl.classList.add('adm-input-error');
        var ee2 = document.getElementById('err-settings-email');
        if (ee2) { ee2.textContent = result.data.message || 'Email already in use.'; ee2.classList.add('visible'); }
      } else {
        showToast(result.data.message || 'Failed to save. Please try again.', 'error');
      }
      return;
    }
    var saved = result.data.admin;
    _updateNavAdminDisplay(saved.full_name);
    var stored = JSON.parse(localStorage.getItem('admin_info') || '{}');
    stored.full_name = saved.full_name;
    stored.email     = saved.email;
    localStorage.setItem('admin_info', JSON.stringify(stored));
    showToast('Account details saved successfully.');
  })
  .catch(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Save Account Details'; }
    showToast('Cannot connect to server. Please try again.', 'error');
  });
}

// ── Change Password Modal ─────────────────
function openChangePwModal() {
  ['chpw-current', 'chpw-new', 'chpw-confirm'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.type = 'password'; el.classList.remove('adm-input-error'); }
  });
  ['chpw-cur-ico', 'chpw-new-ico', 'chpw-conf-ico'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.className = 'fa fa-eye';
  });
  ['err-chpw-current', 'err-chpw-new', 'err-chpw-confirm'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });
  var str = document.getElementById('adm-pw-strength');
  if (str) str.style.display = 'none';
  var label = document.getElementById('adm-pw-label');
  if (label) label.textContent = '';
  ['pw-bar-1','pw-bar-2','pw-bar-3','pw-bar-4'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.className = 'adm-pw-bar'; el.style.background = ''; }
  });
  var btn = document.getElementById('chpw-submit-btn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-lock"></i> Change Password'; }
  openAdmModal('modal-change-pw');
}

function _togglePwField(inputId, iconId) {
  var input = document.getElementById(inputId);
  var ico   = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (ico) ico.className = 'fa fa-eye-slash';
  } else {
    input.type = 'password';
    if (ico) ico.className = 'fa fa-eye';
  }
}

function _updatePwStrength() {
  var pw  = (document.getElementById('chpw-new') || {}).value || '';
  var str = document.getElementById('adm-pw-strength');
  var lbl = document.getElementById('adm-pw-label');
  if (str) str.style.display = pw ? 'flex' : 'none';
  if (!pw) return;

  var score = 0;
  if (pw.length >= 8)          score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  var labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  var colors = ['', '#dc2626', '#f59e0b', '#16a34a', '#16a34a'];

  ['pw-bar-1','pw-bar-2','pw-bar-3','pw-bar-4'].forEach(function(id, i) {
    var bar = document.getElementById(id);
    if (!bar) return;
    if (i < score) {
      bar.classList.add('active');
      bar.style.background = colors[score];
    } else {
      bar.classList.remove('active');
      bar.style.background = '';
    }
  });

  if (lbl) { lbl.textContent = labels[score] || ''; lbl.style.color = colors[score] || ''; }
}

function submitChangePassword() {
  ['err-chpw-current', 'err-chpw-new', 'err-chpw-confirm'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });
  ['chpw-current', 'chpw-new', 'chpw-confirm'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('adm-input-error');
  });

  var cur  = (document.getElementById('chpw-current')  || {}).value || '';
  var nw   = (document.getElementById('chpw-new')      || {}).value || '';
  var conf = (document.getElementById('chpw-confirm')  || {}).value || '';
  var valid = true;

  if (!cur) {
    var e1 = document.getElementById('err-chpw-current');
    var i1 = document.getElementById('chpw-current');
    if (i1) i1.classList.add('adm-input-error');
    if (e1) { e1.textContent = 'Current password is required.'; e1.classList.add('visible'); }
    valid = false;
  }

  var pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!nw || !pwRe.test(nw)) {
    var e2 = document.getElementById('err-chpw-new');
    var i2 = document.getElementById('chpw-new');
    if (i2) i2.classList.add('adm-input-error');
    if (e2) { e2.textContent = nw ? 'Must be 8+ chars with upper, lower, number, and symbol.' : 'New password is required.'; e2.classList.add('visible'); }
    valid = false;
  }

  if (!conf || conf !== nw) {
    var e3 = document.getElementById('err-chpw-confirm');
    var i3 = document.getElementById('chpw-confirm');
    if (i3) i3.classList.add('adm-input-error');
    if (e3) { e3.textContent = conf ? 'Passwords do not match.' : 'Please confirm your new password.'; e3.classList.add('visible'); }
    valid = false;
  }

  if (!valid) return;

  var btn   = document.getElementById('chpw-submit-btn');
  var token = localStorage.getItem('admin_token');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…'; }

  fetch(API_BASE + '/api/admin/password', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body:    JSON.stringify({ current_password: cur, new_password: nw })
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
  .then(function(result) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-lock"></i> Change Password'; }
    if (!result.ok || !result.data.success) {
      if (result.status === 401) {
        var i1 = document.getElementById('chpw-current');
        var e1 = document.getElementById('err-chpw-current');
        if (i1) i1.classList.add('adm-input-error');
        if (e1) { e1.textContent = 'Current password is incorrect.'; e1.classList.add('visible'); }
      } else {
        showToast(result.data.message || 'Failed to change password.', 'error');
      }
      return;
    }
    closeAdmModal('modal-change-pw');
    showToast('Password changed successfully.');
  })
  .catch(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-lock"></i> Change Password'; }
    showToast('Cannot connect to server. Please try again.', 'error');
  });
}
