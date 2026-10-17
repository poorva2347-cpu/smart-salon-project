/* ── Login ── */
async function handleLogin(e) {
  e.preventDefault();

  var email    = document.getElementById('br-email').value.trim();
  var password = document.getElementById('br-password').value.trim();

  if (!email || !password) {
    showToast('Please enter email and password', 'error');
    return;
  }

  var btn          = document.querySelector('#br-login-form .br-login-submit');
  var originalHTML = btn.innerHTML;

  if (btn.disabled) return;

  btn.disabled  = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Signing In...';

  try {
    var response = await fetch('http://localhost:3000/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email, password: password })
    });

    var data = await response.json();

    if (data.success === true) {
      localStorage.setItem('barberToken', data.token);
      localStorage.setItem('barber', JSON.stringify(data.barber));
      showToast('Login Successful', 'success');
      setTimeout(function() { window.location.href = 'dashboard.html'; }, 700);
      return;
    }

    showToast(data.message || 'Login failed. Please try again.', 'error');
    btn.disabled  = false;
    btn.innerHTML = originalHTML;

  } catch (err) {
    showToast('Unable to connect to server. Please try again.', 'error');
    btn.disabled  = false;
    btn.innerHTML = originalHTML;
  }
}

function togglePw() {
  var input    = document.getElementById('br-password');
  var ico      = document.getElementById('br-eye-ico');
  var isHidden = input.type === 'password';
  input.type    = isHidden ? 'text'            : 'password';
  ico.className = isHidden ? 'fa fa-eye-slash' : 'fa fa-eye';
}

/* ── Auth / Session ── */
function getInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/* ── Avatar rendering helper — shows uploaded image or falls back to initials ── */
function resolveBarberImageUrl(imageUrl) {
  if (!imageUrl) return null;
  return imageUrl.indexOf('http') === 0 ? imageUrl : 'http://localhost:3000' + imageUrl;
}

function _showAvatarImage(el, imageUrl) {
  el.textContent = '';
  el.style.backgroundImage    = 'url(' + imageUrl + ')';
  el.style.backgroundSize     = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat   = 'no-repeat';
}

function _showAvatarInitials(el, initials) {
  el.textContent = initials || '?';
  el.style.backgroundImage    = '';
  el.style.backgroundSize     = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat   = '';
}

function _applyAvatar(el, imageUrl, initials) {
  if (!el) return;
  if (!imageUrl) { _showAvatarInitials(el, initials); return; }
  var probe = new Image();
  probe.onload  = function() { _showAvatarImage(el, imageUrl); };
  probe.onerror = function() { _showAvatarInitials(el, initials); };
  probe.src = imageUrl;
}

function getLoggedInBarber() {
  var raw = localStorage.getItem('barber');
  if (!raw) {
    localStorage.removeItem('barberToken');
    localStorage.removeItem('barber');
    window.location.href = 'login.html';
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem('barberToken');
    localStorage.removeItem('barber');
    window.location.href = 'login.html';
    return null;
  }
}

function guardDashboard() {
  var token  = localStorage.getItem('barberToken');
  var barber = localStorage.getItem('barber');
  if (!token || !barber) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function logoutBarber() {
  localStorage.removeItem('barberToken');
  localStorage.removeItem('barber');
  window.location.href = 'login.html';
}

function initBarberProfile(barber) {
  var name      = barber.barber_name || '';
  var initials  = getInitials(name);
  var firstName = name.split(' ')[0] || 'there';
  var avatarUrl = resolveBarberImageUrl(barber.image_url);

  setGreeting(firstName);

  var navAvatar = document.getElementById('br-nav-avatar');
  _applyAvatar(navAvatar, avatarUrl, initials);

  var navName = document.getElementById('br-nav-name');
  if (navName) navName.textContent = name;

  var profileAvatar = document.getElementById('br-profile-avatar-el');
  _applyAvatar(profileAvatar, avatarUrl, initials);

  var profileName = document.getElementById('br-profile-name-el');
  if (profileName) profileName.textContent = name;

  var fullNameVal = document.getElementById('br-profile-fullname-val');
  if (fullNameVal) fullNameVal.textContent = name;

  var emailVal = document.getElementById('br-profile-email-val');
  if (emailVal) emailVal.textContent = barber.email || '—';

  var phoneVal = document.getElementById('br-profile-phone-val');
  if (phoneVal) phoneVal.textContent = barber.phone || '—';

  var epName = document.getElementById('br-ep-name');
  if (epName) epName.value = name;

  var epEmail = document.getElementById('br-ep-email');
  if (epEmail) epEmail.value = barber.email || '';

  var epPhone = document.getElementById('br-ep-phone');
  if (epPhone) epPhone.value = barber.phone || '';

  var epPhotoName = document.getElementById('br-ep-photo-name-el');
  if (epPhotoName) epPhotoName.textContent = name;

  var epAvatar = document.getElementById('br-ep-avatar-preview');
  if (epAvatar && !selectedProfilePhoto) _applyAvatar(epAvatar, avatarUrl, initials);
}

/* ── Greeting ── */
function setGreeting(firstName) {
  var el = document.getElementById('br-greeting-text');
  if (!el) return;
  var h      = new Date().getHours();
  var prefix = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  el.textContent = prefix + ', ' + (firstName || 'there') + ' 👋';
}

/* ── Live date ── */
function setDate() {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now    = new Date();
  const text   = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  var el1 = document.getElementById('br-date-text');
  var el2 = document.getElementById('br-sched-date');
  if (el1) el1.textContent = text;
  if (el2) el2.textContent = text;
}

/* ── Date / Time utilities ── */
var _MONTH_MAP = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
var _MONTH_STR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDateStr(s) {
  var p = s.split(' ');
  return new Date(parseInt(p[2], 10), _MONTH_MAP[p[1]], parseInt(p[0], 10));
}

function isSameDay(d1, d2) {
  return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

function getScheduleTab(dateStr) {
  var d   = parseDateStr(dateStr);
  var now = new Date();
  var tmr = new Date(); tmr.setDate(now.getDate() + 1);
  if (isSameDay(d, now)) return 'today';
  if (isSameDay(d, tmr)) return 'tomorrow';
  return 'upcoming';
}

function parseTimeToMinutes(timeStr) {
  var p = timeStr.split(' '), tp = p[0].split(':');
  var h = parseInt(tp[0], 10), m = parseInt(tp[1], 10);
  if (p[1] === 'PM' && h !== 12) h += 12;
  if (p[1] === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function formatDateForInput(dateStr) {
  var p = dateStr.split(' ');
  var mm = String(_MONTH_MAP[p[1]] + 1).padStart(2, '0');
  return p[2] + '-' + mm + '-' + p[0].padStart(2, '0');
}

function formatTimeForInput(timeStr) {
  var p = timeStr.split(' '), tp = p[0].split(':');
  var h = parseInt(tp[0], 10);
  if (p[1] === 'PM' && h !== 12) h += 12;
  if (p[1] === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + tp[1];
}

function formatInputDate(val) {
  var p = val.split('-');
  return p[2] + ' ' + _MONTH_STR[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function formatInputTime(val) {
  var p = val.split(':'), h = parseInt(p[0], 10), m = p[1];
  var period = h >= 12 ? 'PM' : 'AM';
  var dh = h % 12; if (dh === 0) dh = 12;
  return String(dh).padStart(2, '0') + ':' + m + ' ' + period;
}

/* ── Arrival status (schedule modal only) ── */
function getArrivalStatus(dateStr, timeStr) {
  var apptDate = parseDateStr(dateStr);
  var mins     = parseTimeToMinutes(timeStr);
  apptDate.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  var diffMin  = (new Date() - apptDate) / 60000;
  if (diffMin <= 0)  return { label: 'On Time',         cls: 'arrival-ontime' };
  if (diffMin <= 30) return { label: 'Late Arrival',     cls: 'arrival-late'   };
  return                    { label: 'Potential No Show', cls: 'arrival-noshow' };
}

/* ── Status normalization — maps backend status values to CSS class and human label ── */
function normalizeStatus(status) {
  switch (status) {
    case 'pending':
    case 'pending_approval':    return { cssClass: 'pending-approval',  label: 'Pending Approval'    };
    case 'confirmed':           return { cssClass: 'confirmed',          label: 'Confirmed'           };
    case 'reschedule_proposed': return { cssClass: 'reschedule',         label: 'Reschedule Proposed' };
    case 'completed':           return { cssClass: 'completed',          label: 'Completed'           };
    case 'no_show':             return { cssClass: 'no-show',            label: 'No Show'             };
    case 'rejected':            return { cssClass: 'rejected',           label: 'Rejected'            };
    case 'cancelled':           return { cssClass: 'cancelled',          label: 'Cancelled'           };
    default:                    return { cssClass: 'pending-approval',   label: status || 'Unknown'   };
  }
}

/* ── Auth header helper ── */
function getAuthHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('barberToken')
  };
}

/* ── API date/time formatters ── */
function formatApiDate(dateStr) {
  var s = String(dateStr || '').slice(0, 10);
  var d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.getDate() + ' ' + _MONTH_STR[d.getMonth()] + ' ' + d.getFullYear();
}

function formatApiTime(timeStr) {
  var p = timeStr.split(':'), h = parseInt(p[0], 10), m = p[1];
  var period = h >= 12 ? 'PM' : 'AM';
  var dh = h % 12; if (dh === 0) dh = 12;
  return String(dh).padStart(2, '0') + ':' + m + ' ' + period;
}

function formatInputTimeForApi(val) {
  // Converts "09:00" (input[type=time]) to "9:00 AM" (VALID_TIMES format, no zero-padding)
  var p = val.split(':'), h = parseInt(p[0], 10), m = p[1];
  var period = h >= 12 ? 'PM' : 'AM';
  var dh = h % 12; if (dh === 0) dh = 12;
  return dh + ':' + m + ' ' + period;
}

/* ── Map API appointment record to frontend shape ── */
function mapApiAppointment(appt) {
  var norm  = normalizeStatus(appt.status);
  var name  = appt.customer_name || 'Unknown';
  var parts = name.trim().split(/\s+/);
  var av    = parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  var service = (appt.services || []).map(function(s) { return s.service_name; }).join(', ') || '—';
  var advance = appt.total_amount != null ? '₹' + Math.round(parseFloat(appt.total_amount)) : '—';
  return {
    id:          appt.appointment_id,
    av:          av,
    name:        name,
    phone:       appt.customer_phone || '—',
    service:     service,
    date:        formatApiDate(appt.appointment_date),
    time:        formatApiTime(appt.appointment_time),
    advance:     advance,
    statusClass: norm.cssClass,
    statusLabel: norm.label
  };
}

/* ── Load all appointments from backend and populate datasets ── */
async function loadAppointments() {
  var token = localStorage.getItem('barberToken');
  if (!token) return;

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments', {
      headers: getAuthHeaders()
    });

    if (response.status === 401) { logoutBarber(); return; }

    var data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Failed to load appointments.', 'error');
      return;
    }

    var appointments = data.appointments || [];

    workQueueData.requests.length  = 0;
    workQueueData.completed.length = 0;
    workQueueData.history.length   = 0;
    workQueueData.action.length    = 0;
    scheduleData.length            = 0;

    appointments.forEach(function(appt) {
      var mapped = mapApiAppointment(appt);
      var s      = appt.status;
      if (s === 'pending_approval' || s === 'pending') {
        workQueueData.requests.push(mapped);
      } else if (s === 'confirmed') {
        scheduleData.push(mapped);
      } else if (s === 'completed') {
        workQueueData.completed.push(mapped);
      } else if (s === 'no_show' || s === 'rejected' || s === 'cancelled') {
        workQueueData.history.push(mapped);
      } else if (s === 'reschedule_proposed') {
        workQueueData.action.push(mapped);
      }
    });

    refreshDashboard();
    renderSchedule();

  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Schedule dataset — populated by loadAppointments() ── */
var scheduleData = [];

/* ── Schedule — Render ── */
function renderScheduleCard(appt) {
  var tp    = appt.time.split(' ');
  var sdIdx = scheduleData.indexOf(appt);
  return '<div class="br-appt-card">' +
    '<div class="br-appt-time-col">' +
      '<div class="br-appt-hour">' + tp[0] + '</div>' +
      '<div class="br-appt-period">' + tp[1] + '</div>' +
    '</div>' +
    '<div class="br-appt-info">' +
      '<div class="br-appt-customer">' + appt.name + '</div>' +
      '<div class="br-appt-service"><i class="fa fa-scissors"></i> ' + appt.service + '</div>' +
    '</div>' +
    '<div class="br-appt-meta">' +
      '<span class="br-badge confirmed">Confirmed</span>' +
      '<button class="br-view-details-btn" onclick="openScheduleModal(' + sdIdx + ')"><i class="fa fa-arrow-right"></i> View Details</button>' +
    '</div>' +
  '</div>';
}

function renderSchedule() {
  var byTime = function(a, b) { return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time); };
  var todayList = [], tomorrowList = [], upcomingList = [];

  scheduleData.forEach(function(appt) {
    var tab = getScheduleTab(appt.date);
    if (tab === 'today')         todayList.push(appt);
    else if (tab === 'tomorrow') tomorrowList.push(appt);
    else                         upcomingList.push(appt);
  });

  todayList.sort(byTime);
  tomorrowList.sort(byTime);
  upcomingList.sort(function(a, b) {
    var dd = parseDateStr(a.date) - parseDateStr(b.date);
    return dd !== 0 ? dd : byTime(a, b);
  });

  var emptyHtml = '<p class="br-empty-state"><i class="fa fa-calendar-xmark"></i> No appointments.</p>';

  var todayEl = document.querySelector('#br-sched-today .br-appt-list');
  if (todayEl) todayEl.innerHTML = todayList.length ? todayList.map(renderScheduleCard).join('') : emptyHtml;

  var tomorrowEl = document.querySelector('#br-sched-tomorrow .br-appt-list');
  if (tomorrowEl) tomorrowEl.innerHTML = tomorrowList.length ? tomorrowList.map(renderScheduleCard).join('') : emptyHtml;

  var upcomingEl = document.getElementById('br-sched-upcoming');
  if (!upcomingEl) return;
  if (upcomingList.length === 0) { upcomingEl.innerHTML = emptyHtml; return; }

  var groups = {}, order = [];
  upcomingList.forEach(function(appt) {
    if (!groups[appt.date]) { groups[appt.date] = []; order.push(appt.date); }
    groups[appt.date].push(appt);
  });

  var wdays   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var wmonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  upcomingEl.innerHTML = order.map(function(dateStr) {
    var d     = parseDateStr(dateStr);
    var label = wdays[d.getDay()] + ', ' + d.getDate() + ' ' + wmonths[d.getMonth()] + ' ' + d.getFullYear();
    return '<div class="br-date-group">' +
      '<div class="br-date-label"><i class="fa fa-calendar"></i> ' + label + '</div>' +
      '<div class="br-appt-list">' + groups[dateStr].map(renderScheduleCard).join('') + '</div>' +
    '</div>';
  }).join('');
}

/* ── Work queue datasets — populated by loadAppointments() ── */
var _modalDataset      = [];
var _currentModalIdx   = -1;
var _modalContext      = 'dashboard';
var selectedProfilePhoto = null;

var workQueueData = {
  requests:  [],
  completed: [],
  history:   [],
  action:    []
};

function renderWorkQueue(dataset) {
  _modalDataset = dataset;
  var tbody = document.getElementById('br-work-tbody');
  if (!tbody) return;
  if (dataset.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="br-empty-row">No appointments in this category.</td></tr>';
    return;
  }
  tbody.innerHTML = dataset.map(function(row, idx) {
    return '<tr>' +
      '<td><div class="br-cust-cell"><div class="br-cust-av">' + row.av + '</div>' +
      '<span class="br-cust-name" onclick="openModal(' + idx + ')">' + row.name + '</span></div></td>' +
      '<td>' + row.service + '</td>' +
      '<td>' + row.date + '</td>' +
      '<td>' + row.time + '</td>' +
      '<td><span class="br-badge ' + row.statusClass + '">' + row.statusLabel + '</span></td>' +
      '<td><button class="br-view-btn" onclick="openModal(' + idx + ')"><i class="fa fa-eye"></i> View</button></td>' +
      '</tr>';
  }).join('');
}

function updateWorkQueueCounts() {
  var cr = document.getElementById('br-count-requests');
  var cc = document.getElementById('br-count-completed');
  var ch = document.getElementById('br-count-history');
  var ca = document.getElementById('br-count-action');
  if (cr) cr.textContent = workQueueData.requests.length;
  if (cc) cc.textContent = workQueueData.completed.length;
  if (ch) ch.textContent = workQueueData.history.length;
  if (ca) ca.textContent = workQueueData.action.length;
}

function refreshDashboard() {
  var activeTab = document.querySelector('.br-work-tab.active');
  var tab = activeTab ? activeTab.getAttribute('data-tab') : 'requests';
  renderWorkQueue(workQueueData[tab] || workQueueData.requests);
  updateWorkQueueCounts();
}

/* ── Modal footer — Dashboard context ── */
function getModalFooterHTML(statusClass) {
  if (statusClass === 'pending-approval') {
    return '<button class="br-modal-btn br-modal-btn-accept" onclick="acceptAppointment()"><i class="fa fa-check"></i> Accept</button>' +
           '<button class="br-modal-btn br-modal-btn-reject" onclick="openRejectConfirm()"><i class="fa fa-xmark"></i> Reject</button>';
  }
  if (statusClass === 'completed' || statusClass === 'no-show' ||
      statusClass === 'rejected'  || statusClass === 'cancelled' ||
      statusClass === 'reschedule') {
    return '<button class="br-modal-btn br-modal-btn-neutral" onclick="closeModal()"><i class="fa fa-xmark"></i> Close</button>';
  }
  return '<button class="br-modal-btn br-modal-btn-reschedule" onclick="openRescheduleModal()"><i class="fa fa-calendar-days"></i> Reschedule</button>' +
         '<button class="br-modal-btn br-modal-btn-neutral" onclick="closeModal()"><i class="fa fa-xmark"></i> Close</button>';
}

/* ── Modal footer — Schedule context (confirmed appointments) ── */
function getScheduleModalFooterHTML() {
  return '<button class="br-modal-btn br-modal-btn-accept" onclick="openCompleteConfirm()"><i class="fa fa-circle-check"></i> Complete</button>' +
         '<button class="br-modal-btn br-modal-btn-noshow" onclick="openNoShowConfirm()"><i class="fa fa-user-slash"></i> No Show</button>' +
         '<button class="br-modal-btn br-modal-btn-reschedule" onclick="openRescheduleModal()"><i class="fa fa-calendar-days"></i> Reschedule</button>' +
         '<button class="br-modal-btn br-modal-btn-neutral" onclick="closeModal()"><i class="fa fa-xmark"></i> Close</button>';
}

/* ── Shared modal field population ── */
function _populateModal(data) {
  document.getElementById('br-modal-avatar').textContent  = data.av;
  document.getElementById('br-modal-name').textContent    = data.name;
  document.getElementById('br-modal-phone').textContent   = data.phone;
  document.getElementById('br-modal-service').textContent = data.service;
  document.getElementById('br-modal-date').textContent    = data.date;
  document.getElementById('br-modal-time').textContent    = data.time;
  document.getElementById('br-modal-advance').textContent = data.advance;
  var statusEl = document.getElementById('br-modal-status');
  statusEl.className   = 'br-badge ' + data.statusClass;
  statusEl.textContent = data.statusLabel;
}

/* ── Dashboard modal (work queue) ── */
function openModal(idx) {
  _modalContext    = 'dashboard';
  _currentModalIdx = idx;
  var data = _modalDataset[idx];
  if (!data) return;
  _populateModal(data);
  var arrWrap = document.getElementById('br-modal-arrival-wrap');
  if (arrWrap) arrWrap.style.display = 'none';
  document.getElementById('br-modal-footer').innerHTML = getModalFooterHTML(data.statusClass);
  document.getElementById('br-modal-overlay').classList.add('active');
  document.body.classList.add('br-modal-open');
}

/* ── Schedule modal (confirmed appointments) ── */
function openScheduleModal(sdIdx) {
  _modalContext    = 'schedule';
  _modalDataset    = scheduleData;
  _currentModalIdx = sdIdx;
  var data = scheduleData[sdIdx];
  if (!data) return;
  _populateModal(data);
  var arrWrap  = document.getElementById('br-modal-arrival-wrap');
  var arrBadge = document.getElementById('br-modal-arrival-badge');
  if (arrWrap && arrBadge) {
    var status           = getArrivalStatus(data.date, data.time);
    arrBadge.className   = 'br-badge ' + status.cls;
    arrBadge.textContent = status.label;
    arrWrap.style.display = '';
  }
  document.getElementById('br-modal-footer').innerHTML = getScheduleModalFooterHTML();
  document.getElementById('br-modal-overlay').classList.add('active');
  document.body.classList.add('br-modal-open');
}

function closeModal() {
  document.getElementById('br-modal-overlay').classList.remove('active');
  document.body.classList.remove('br-modal-open');
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('br-modal-overlay')) closeModal();
}

/* ── Accept (pending_approval → confirmed) ── */
async function acceptAppointment() {
  var appt = _modalDataset[_currentModalIdx];
  if (!appt || !appt.id) return;

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments/' + appt.id + '/accept', {
      method:  'PUT',
      headers: getAuthHeaders()
    });
    if (response.status === 401) { logoutBarber(); return; }
    var data = await response.json();
    if (!response.ok) { showToast(data.error || 'Failed to accept appointment.', 'error'); return; }
    closeModal();
    await loadAppointments();
    showToast('Appointment Confirmed', 'success');
  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Reject (requests → removed) ── */
function openRejectConfirm() {
  document.getElementById('br-reject-overlay').classList.add('active');
}

function closeRejectConfirm() {
  document.getElementById('br-reject-overlay').classList.remove('active');
}

function handleRejectOverlayClick(e) {
  if (e.target === document.getElementById('br-reject-overlay')) closeRejectConfirm();
}

async function confirmReject() {
  var appt = _modalDataset[_currentModalIdx];
  if (!appt || !appt.id) return;

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments/' + appt.id + '/reject', {
      method:  'PUT',
      headers: getAuthHeaders()
    });
    if (response.status === 401) { logoutBarber(); return; }
    var data = await response.json();
    if (!response.ok) { showToast(data.error || 'Failed to reject appointment.', 'error'); return; }
    closeRejectConfirm();
    closeModal();
    await loadAppointments();
    showToast('Appointment Rejected', 'error');
  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Complete (scheduleData → completed) ── */
function openCompleteConfirm() {
  document.getElementById('br-complete-overlay').classList.add('active');
}

function closeCompleteConfirm() {
  document.getElementById('br-complete-overlay').classList.remove('active');
}

function handleCompleteOverlayClick(e) {
  if (e.target === document.getElementById('br-complete-overlay')) closeCompleteConfirm();
}

async function confirmComplete() {
  var appt = _modalDataset[_currentModalIdx];
  if (!appt || !appt.id) return;

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments/' + appt.id + '/complete', {
      method:  'PUT',
      headers: getAuthHeaders()
    });
    if (response.status === 401) { logoutBarber(); return; }
    var data = await response.json();
    if (!response.ok) { showToast(data.error || 'Failed to complete appointment.', 'error'); return; }
    closeCompleteConfirm();
    closeModal();
    await loadAppointments();
    showToast('Appointment Completed', 'success');
  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── No Show (scheduleData → completed) ── */
function openNoShowConfirm() {
  document.getElementById('br-noshow-overlay').classList.add('active');
}

function closeNoShowConfirm() {
  document.getElementById('br-noshow-overlay').classList.remove('active');
}

function handleNoShowOverlayClick(e) {
  if (e.target === document.getElementById('br-noshow-overlay')) closeNoShowConfirm();
}

async function confirmNoShow() {
  var appt = _modalDataset[_currentModalIdx];
  if (!appt || !appt.id) return;

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments/' + appt.id + '/no-show', {
      method:  'PUT',
      headers: getAuthHeaders()
    });
    if (response.status === 401) { logoutBarber(); return; }
    var data = await response.json();
    if (!response.ok) { showToast(data.error || 'Failed to mark no-show.', 'error'); return; }
    closeNoShowConfirm();
    closeModal();
    await loadAppointments();
    showToast('Customer Marked As No Show', 'error');
  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Reschedule modal ── */
function openRescheduleModal() {
  var appt = _modalDataset[_currentModalIdx];
  if (!appt) return;
  document.getElementById('br-reschedule-customer-name').textContent = appt.name;
  document.getElementById('br-reschedule-current-val').textContent   = appt.date + ' · ' + appt.time;
  document.getElementById('br-new-date').value   = formatDateForInput(appt.date);
  document.getElementById('br-new-time').value   = formatTimeForInput(appt.time);
  document.getElementById('br-reschedule-reason').value = '';
  document.getElementById('br-reschedule-overlay').classList.add('active');
}

function closeRescheduleModal() {
  document.getElementById('br-reschedule-overlay').classList.remove('active');
}

function handleRescheduleOverlayClick(e) {
  if (e.target === document.getElementById('br-reschedule-overlay')) closeRescheduleModal();
}

async function submitReschedule() {
  var dateVal = document.getElementById('br-new-date').value;
  var timeVal = document.getElementById('br-new-time').value;
  if (!dateVal || !timeVal) { showToast('Please select a new date and time.', 'error'); return; }

  var appt = _modalDataset[_currentModalIdx];
  if (!appt || !appt.id) return;

  var reason = document.getElementById('br-reschedule-reason').value.trim();

  try {
    var response = await fetch('http://localhost:3000/api/barber/appointments/' + appt.id + '/reschedule', {
      method:  'PUT',
      headers: getAuthHeaders(),
      body:    JSON.stringify({
        proposed_date: dateVal,
        proposed_time: formatInputTimeForApi(timeVal),
        reason:        reason || null
      })
    });
    if (response.status === 401) { logoutBarber(); return; }
    var data = await response.json();
    if (!response.ok) { showToast(data.error || 'Failed to send reschedule request.', 'error'); return; }
    closeRescheduleModal();
    closeModal();
    await loadAppointments();
    showToast('Reschedule Request Sent', 'info');
  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Toast ── */
function showToast(message, type) {
  var container = document.getElementById('br-toast-container');
  if (!container) return;
  var iconMap = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  var toast   = document.createElement('div');
  toast.className = 'br-toast br-toast-' + (type || 'success');
  toast.innerHTML = '<i class="fa ' + (iconMap[type] || 'fa-circle-check') + '"></i><span>' + message + '</span>';
  container.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3000);
}

/* ── Work queue tab switching ── */
function switchTab(el) {
  document.querySelectorAll('.br-work-tab').forEach(function(btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-selected', 'true');
  var dataset = workQueueData[el.getAttribute('data-tab')] || workQueueData.requests;
  var tbody   = document.getElementById('br-work-tbody');
  if (tbody) {
    tbody.classList.add('br-fading');
    setTimeout(function() {
      renderWorkQueue(dataset);
      tbody.classList.remove('br-fading');
    }, 120);
  }
}

/* ── Section switching ── */
function switchSection(sectionId, navEl) {
  document.querySelectorAll('.br-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.br-nav-item').forEach(function(n) { n.classList.remove('active'); });
  var section = document.getElementById(sectionId);
  if (section) section.classList.add('active');
  if (navEl)   navEl.classList.add('active');
  var sidebar = document.getElementById('br-sidebar');
  var overlay = document.getElementById('br-sidebar-overlay');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('show');
  }
}

/* ── Schedule tab switching ── */
function switchSchedTab(panelId, el) {
  document.querySelectorAll('.br-sched-tab').forEach(function(t) {
    t.classList.remove('active'); t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.br-sched-panel').forEach(function(p) { p.classList.remove('active'); });
  el.classList.add('active');
  el.setAttribute('aria-selected', 'true');
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

/* ── Availability — shared state ── */
function _setAvailability(available) {
  var pairs = [
    ['br-avail-toggle',         'br-avail-dot',         'br-avail-text'        ],
    ['br-profile-avail-toggle', 'br-profile-avail-dot', 'br-profile-avail-text'],
    ['br-ep-avail-toggle',      'br-ep-avail-dot',      'br-ep-avail-text'     ]
  ];
  pairs.forEach(function(p) {
    var t = document.getElementById(p[0]);
    var d = document.getElementById(p[1]);
    var x = document.getElementById(p[2]);
    if (t) t.checked   = available;
    if (d) d.className = 'br-avail-dot ' + (available ? 'available' : 'unavailable');
    if (x) x.textContent = available ? 'Available' : 'Unavailable';
  });
}

function toggleAvailability() {
  var toggle = document.getElementById('br-avail-toggle');
  if (toggle) _setAvailability(toggle.checked);
}

function toggleProfileAvailability() {
  var toggle = document.getElementById('br-profile-avail-toggle');
  if (toggle) _setAvailability(toggle.checked);
}

function toggleEpAvailability() {
  var toggle = document.getElementById('br-ep-avail-toggle');
  if (toggle) _setAvailability(toggle.checked);
}

/* ── Profile Photo Upload ── */
function handlePhotoSelect(input) {
  var file = input.files[0];
  if (!file) return;
  var validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (validTypes.indexOf(file.type) === -1) {
    showToast('Please upload a JPG or PNG image', 'error');
    input.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image size must be less than 2 MB', 'error');
    input.value = '';
    return;
  }
  var avatar = document.getElementById('br-ep-avatar-preview');
  var reader = new FileReader();
  reader.onload = function(e) {
    selectedProfilePhoto = e.target.result;
    _applyAvatar(avatar, e.target.result, null);
  };
  reader.readAsDataURL(file);

  uploadBarberPhoto(file, avatar);
}

async function uploadBarberPhoto(file, avatarEl) {
  var formData = new FormData();
  formData.append('image', file);

  try {
    var response = await fetch('http://localhost:3000/api/barber/profile/photo', {
      method:  'PUT',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('barberToken') },
      body:    formData
    });

    if (response.status === 401) { logoutBarber(); return; }

    var data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Failed to upload image.', 'error');
      selectedProfilePhoto = null;
      var fallback = getLoggedInBarber();
      _applyAvatar(avatarEl, resolveBarberImageUrl(fallback && fallback.image_url), fallback ? getInitials(fallback.barber_name) : '?');
      return;
    }

    var barber = data.barber;
    localStorage.setItem('barber', JSON.stringify(barber));

    var resolvedUrl = resolveBarberImageUrl(barber.image_url);
    selectedProfilePhoto = resolvedUrl;
    var initials = getInitials(barber.barber_name);

    _applyAvatar(document.getElementById('br-nav-avatar'),        resolvedUrl, initials);
    _applyAvatar(document.getElementById('br-profile-avatar-el'), resolvedUrl, initials);
    _applyAvatar(avatarEl,                                        resolvedUrl, initials);

    showToast('Profile photo updated successfully', 'success');

  } catch (err) {
    showToast('Unable to connect to server.', 'error');
  }
}

/* ── Edit Profile Modal ── */
function openEditProfileModal() {
  var navToggle = document.getElementById('br-avail-toggle');
  var available = navToggle ? navToggle.checked : true;
  var epToggle  = document.getElementById('br-ep-avail-toggle');
  var epDot     = document.getElementById('br-ep-avail-dot');
  var epText    = document.getElementById('br-ep-avail-text');
  if (epToggle)  epToggle.checked   = available;
  if (epDot)     epDot.className    = 'br-avail-dot ' + (available ? 'available' : 'unavailable');
  if (epText)    epText.textContent = available ? 'Available' : 'Unavailable';
  var body = document.getElementById('br-ep-accordion-body');
  var icon = document.querySelector('.br-ep-accordion-icon');
  var btn  = document.querySelector('.br-ep-accordion-toggle');
  if (body) body.classList.remove('open');
  if (icon) icon.style.transform = '';
  if (btn)  { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  var avatarPreview = document.getElementById('br-ep-avatar-preview');
  if (avatarPreview) {
    if (selectedProfilePhoto) {
      _applyAvatar(avatarPreview, selectedProfilePhoto, null);
    } else {
      var b = getLoggedInBarber();
      _applyAvatar(avatarPreview, resolveBarberImageUrl(b && b.image_url), b ? getInitials(b.barber_name) : '?');
    }
  }
  var photoInput = document.getElementById('br-ep-photo-input');
  if (photoInput) photoInput.value = '';
  document.getElementById('br-edit-profile-overlay').classList.add('active');
  document.body.classList.add('br-modal-open');
}

function closeEditProfileModal() {
  document.getElementById('br-edit-profile-overlay').classList.remove('active');
  document.body.classList.remove('br-modal-open');
}

function handleEditProfileOverlayClick(e) {
  if (e.target === document.getElementById('br-edit-profile-overlay')) closeEditProfileModal();
}

function toggleEpAccordion(btn) {
  var body  = document.getElementById('br-ep-accordion-body');
  var icon  = btn.querySelector('.br-ep-accordion-icon');
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open');
  btn.classList.toggle('open');
  icon.style.transform       = isOpen ? '' : 'rotate(180deg)';
  btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
}

function submitEditProfile() {
  var curr = document.getElementById('br-ep-curr-pw').value;
  var np   = document.getElementById('br-ep-new-pw').value;
  var cp   = document.getElementById('br-ep-confirm-pw').value;

  if (curr || np || cp) {
    if (!curr || !np || !cp) { showToast('Please fill in all password fields.', 'error'); return; }
    if (np !== cp)           { showToast('Passwords do not match.', 'error'); return; }
    if (np.length < 6)       { showToast('New password must be at least 6 characters.', 'error'); return; }

    fetch('http://localhost:3000/api/barber/change-password', {
      method:  'PATCH',
      headers: getAuthHeaders(),
      body:    JSON.stringify({ current_password: curr, new_password: np })
    })
    .then(function(res) {
      return res.json().then(function(data) { return { ok: res.ok, data: data }; });
    })
    .then(function(result) {
      if (!result.ok || !result.data.success) {
        showToast(result.data.message || 'Failed to update password.', 'error');
        return;
      }
      document.getElementById('br-ep-curr-pw').value    = '';
      document.getElementById('br-ep-new-pw').value     = '';
      document.getElementById('br-ep-confirm-pw').value = '';
      closeEditProfileModal();
      showToast('Password updated successfully.', 'success');
    })
    .catch(function() {
      showToast('Unable to connect to server.', 'error');
    });
    return;
  }

  closeEditProfileModal();
}

/* ── Mobile sidebar ── */
function toggleSidebar() {
  var sidebar = document.getElementById('br-sidebar');
  var overlay = document.getElementById('br-sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
}

/* ── Notification System ── */
var NOTIF_TYPE_META = {
  new_request:         { icon: 'fa-calendar-plus',  cls: 'br-notif-icon--request'   },
  cancelled:           { icon: 'fa-calendar-xmark', cls: 'br-notif-icon--cancelled'  },
  updated:             { icon: 'fa-pen-to-square',  cls: 'br-notif-icon--updated'    },
  reschedule_accepted: { icon: 'fa-circle-check',   cls: 'br-notif-icon--accepted'   },
  reschedule_rejected: { icon: 'fa-circle-xmark',   cls: 'br-notif-icon--rejected'   }
};

var notificationsData = [];

function timeAgo(date) {
  var diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  { var m = Math.floor(diff / 60);   return m + (m === 1 ? ' min ago'  : ' mins ago');  }
  if (diff < 86400) { var h = Math.floor(diff / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
  var d = Math.floor(diff / 86400);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

function getUnreadCount() {
  return notificationsData.filter(function(n) { return !n.read; }).length;
}

function updateNotifBadge() {
  var badge = document.getElementById('br-notif-badge-count');
  if (!badge) return;
  var count = getUnreadCount();
  if (count === 0) {
    badge.style.display = 'none';
  } else {
    badge.style.display = '';
    badge.textContent   = count > 99 ? '99+' : String(count);
  }
}

function renderNotifCard(notif) {
  var meta = NOTIF_TYPE_META[notif.type] || NOTIF_TYPE_META.new_request;
  return '<div class="br-notif-card' + (notif.read ? '' : ' unread') + '" onclick="markNotifRead(' + notif.id + ')">' +
    '<div class="br-notif-icon-wrap ' + meta.cls + '"><i class="fa ' + meta.icon + '"></i></div>' +
    '<div class="br-notif-card-content">' +
      '<div class="br-notif-card-title">' + notif.title + '</div>' +
      '<p class="br-notif-card-msg">' + notif.message + '</p>' +
      '<div class="br-notif-card-time">' + timeAgo(notif.createdAt) + '</div>' +
    '</div>' +
    '<div class="br-notif-unread-dot"></div>' +
  '</div>';
}

function renderNotifications() {
  var list = document.getElementById('br-notif-list');
  if (!list) return;
  if (notificationsData.length === 0) {
    list.innerHTML = '<div class="br-notif-empty">' +
      '<div class="br-notif-empty-icon"><i class="fa fa-bell-slash"></i></div>' +
      '<div class="br-notif-empty-text">No notifications yet</div>' +
      '<div class="br-notif-empty-sub">New activity will appear here</div>' +
    '</div>';
    return;
  }
  list.innerHTML = notificationsData.map(renderNotifCard).join('');
}

function openNotifDrawer() {
  renderNotifications();
  document.getElementById('br-notif-drawer').classList.add('open');
  document.getElementById('br-notif-overlay').classList.add('active');
  document.body.classList.add('br-modal-open');
  loadNotifications();
}

function closeNotifDrawer() {
  document.getElementById('br-notif-drawer').classList.remove('open');
  document.getElementById('br-notif-overlay').classList.remove('active');
  document.body.classList.remove('br-modal-open');
}

function handleNotifOverlayClick(e) {
  if (e.target === document.getElementById('br-notif-overlay')) closeNotifDrawer();
}

async function markNotifRead(id) {
  var notif = notificationsData.find(function(n) { return n.id === id; });
  if (!notif || notif.read) return;
  notif.read = true;
  renderNotifications();
  updateNotifBadge();
  try {
    await fetch('http://localhost:3000/api/barber/notifications/' + id + '/read', {
      method: 'PUT', headers: getAuthHeaders()
    });
  } catch (err) { /* silent — UI already updated locally */ }
}

async function markAllRead() {
  notificationsData.forEach(function(n) { n.read = true; });
  renderNotifications();
  updateNotifBadge();
  try {
    await fetch('http://localhost:3000/api/barber/notifications/read-all', {
      method: 'PUT', headers: getAuthHeaders()
    });
  } catch (err) { /* silent */ }
}

function initNotifications() {
  updateNotifBadge();
  loadNotifications();
}

async function loadNotifications() {
  var token = localStorage.getItem('barberToken');
  if (!token) return;
  try {
    var response = await fetch('http://localhost:3000/api/barber/notifications', {
      headers: getAuthHeaders()
    });
    if (response.status === 401) { logoutBarber(); return; }
    if (!response.ok) return;
    var data = await response.json();
    notificationsData = (data.notifications || []).map(function(n) {
      return {
        id:        n.id,
        type:      n.type,
        title:     n.title,
        message:   n.message,
        createdAt: new Date(n.created_at),
        read:      n.is_read === 1 || n.is_read === true
      };
    });
    updateNotifBadge();
    var drawer = document.getElementById('br-notif-drawer');
    if (drawer && drawer.classList.contains('open')) renderNotifications();
  } catch (err) { /* silent */ }
}

/* ── Init ── */
function initWorkQueue() {
  updateWorkQueueCounts();
  renderWorkQueue(workQueueData.requests);
}

document.addEventListener('DOMContentLoaded', function() {
  if (!document.getElementById('br-main')) return;

  if (!guardDashboard()) return;
  var barber = getLoggedInBarber();
  if (!barber) return;

  setDate();
  initBarberProfile(barber);
  initNotifications();
  loadAppointments();

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('br-notif-drawer').classList.contains('open'))            { closeNotifDrawer();        return; }
    if (document.getElementById('br-reschedule-overlay').classList.contains('active'))    { closeRescheduleModal();    return; }
    if (document.getElementById('br-reject-overlay').classList.contains('active'))        { closeRejectConfirm();      return; }
    if (document.getElementById('br-complete-overlay').classList.contains('active'))      { closeCompleteConfirm();    return; }
    if (document.getElementById('br-noshow-overlay').classList.contains('active'))        { closeNoShowConfirm();      return; }
    if (document.getElementById('br-edit-profile-overlay').classList.contains('active'))  { closeEditProfileModal();   return; }
    closeModal();
  });
});
