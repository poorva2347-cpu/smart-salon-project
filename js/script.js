/* ══════════════════════════════════════════════════════════
   SMART SALON — script.js
   Updated: multi-service selection, AI fab morph, no style-picker
══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   0. CUSTOMER STATE — single source of truth
───────────────────────────────────────── */
const currentCustomer = {
  name:     '',
  email:    '',
  phone:    '',
  initials: ''
};

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function syncProfileUI() {
  const { name, email, phone, initials } = currentCustomer;

  // Navbar
  document.querySelectorAll('.profile-avatar').forEach(el => el.textContent = initials);
  const usernameEl = document.getElementById('nav-username');
  if (usernameEl) usernameEl.textContent = name;
  const pdName  = document.querySelector('.pd-name');
  const pdEmail = document.querySelector('.pd-email');
  if (pdName)  pdName.textContent  = name;
  if (pdEmail) pdEmail.textContent = email;

  // Drawer My Profile pane
  const dpAvatar     = document.querySelector('.dp-avatar');
  const dpName       = document.querySelector('.dp-name');
  const dpEmailLabel = document.querySelector('.dp-email-label');
  if (dpAvatar)     dpAvatar.textContent     = initials;
  if (dpName)       dpName.textContent       = name;
  if (dpEmailLabel) dpEmailLabel.textContent = email;

  const dpFieldName  = document.getElementById('dp-field-name');
  const dpFieldPhone = document.getElementById('dp-field-phone');
  const dpFieldEmail = document.getElementById('dp-field-email');
  if (dpFieldName)  dpFieldName.textContent  = name;
  if (dpFieldPhone) dpFieldPhone.textContent = phone;
  if (dpFieldEmail) dpFieldEmail.textContent = email;

  // Edit Profile modal avatar
  const epAvatar = document.querySelector('.ep-avatar-lg');
  if (epAvatar) epAvatar.textContent = initials;

  renderRecentNotifications();
}

async function loadProfile() {
  const token = localStorage.getItem('customerToken');

  if (!token) {
    window.location.replace('auth/login.html');
    return;
  }

  try {
    const res = await fetch(API_BASE + '/profile', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
      return;
    }

    if (!res.ok) { syncProfileUI(); return; }

    const data = await res.json();
    const p    = data.profile;

    currentCustomer.name     = p.full_name || '';
    currentCustomer.email    = p.email     || '';
    currentCustomer.phone    = p.phone     || '';
    currentCustomer.initials = getInitials(p.full_name || '');

    syncProfileUI();

  } catch (_err) {
    // Network error — keep UI as-is, do not redirect
  }
}

async function loadServices() {
  try {
    const res = await fetch(API_BASE + '/services');
    if (!res.ok) return;
    const data = await res.json();
    const services = data.services;
    if (!services || services.length === 0) return;

    // Update servicePrices — consumed by syncConfirmation() and prompts.js
    Object.keys(servicePrices).forEach(k => delete servicePrices[k]);
    services.forEach(s => {
      servicePrices[s.service_name] = Math.round(parseFloat(s.price));
    });

    // Update APPT_SERVICE_NAMES + APPT_SERVICE_PRICES — consumed by edit-appointment modal
    APPT_SERVICE_NAMES.length = 0;
    Object.keys(APPT_SERVICE_PRICES).forEach(k => delete APPT_SERVICE_PRICES[k]);
    services.forEach(s => {
      const price = Math.round(parseFloat(s.price));
      APPT_SERVICE_NAMES.push(s.service_name);
      APPT_SERVICE_PRICES[s.service_name] = price;
      APPT_SERVICE_ID_MAP[s.service_name] = s.service_id;
    });

    // Render cards into the grid
    const grid = document.querySelector('.services-grid');
    if (!grid) return;

    grid.innerHTML = services.map(s => {
      const price   = Math.round(parseFloat(s.price));
      const slug    = 'svc-' + s.service_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const imgHtml = s.image_url
        ? `<img src="${s.image_url}" alt="${s.service_name}">`
        : `<i class="fa fa-scissors" style="font-size:2rem;color:var(--secondary);opacity:0.6"></i>`;
      return `<div class="svc-card" id="${slug}" onclick="toggleService(this,'${s.service_name}','₹${price}')">
        <div class="svc-icon-area">
          ${imgHtml}
        </div>
        <div class="svc-body">
          <div class="svc-name">${s.service_name}</div>
          <div class="svc-desc">${s.description}</div>
          <div class="svc-price"><sup>₹</sup>${price} <span>onwards</span></div>
          <button class="svc-btn">Add Service</button>
        </div>
      </div>`;
    }).join('');

  } catch (_err) {
    // Network error — hardcoded cards remain as fallback
  }
}

async function saveProfile() {
  const nameVal  = (document.getElementById('ep-name')?.value  || '').trim();
  const phoneVal = (document.getElementById('ep-phone')?.value || '').trim();

  if (!nameVal)  { showToast('Please enter your full name.', 'error');    return; }
  if (!phoneVal) { showToast('Please enter your phone number.', 'error'); return; }

  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }

  try {
    const res  = await fetch(API_BASE + '/profile', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ full_name: nameVal, phone: phoneVal })
    });
    const data = await res.json();

    if (res.ok) {
      const p = data.profile;
      currentCustomer.name     = p.full_name;
      currentCustomer.email    = p.email;
      currentCustomer.phone    = p.phone || '';
      currentCustomer.initials = getInitials(p.full_name);
      syncProfileUI();
      closeAccountModal('modal-edit-profile');
      showToast('Profile updated successfully.');
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Update failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('ss-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = 'ss-toast ss-toast--' + type + ' show';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ─────────────────────────────────────────
   1. NAVBAR SCROLL
───────────────────────────────────────── */
const nav = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ─────────────────────────────────────────
   2. INTERSECTION OBSERVER — fade-up
───────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {

  loadProfile();
  loadServices();
  loadBarbers();
  loadCustomerNotifications();

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('vis');
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.fu').forEach(el => {
    obs.observe(el);
  });

});


/* ─────────────────────────────────────────
   3. DEFAULT DATE in modal (tomorrow)
───────────────────────────────────────── */
const tm = new Date();
tm.setDate(tm.getDate() + 1);
const dateInput = document.getElementById('m-date');
if (dateInput) dateInput.value = tm.toISOString().split('T')[0];


/* ─────────────────────────────────────────
   4. AI ASSISTANT FAB — scroll morph
   • Collapses to circle while scrolling
   • Expands back to pill when scroll stops
───────────────────────────────────────── */
const aiFab = document.getElementById('ai-fab');
let scrollEndTimer = null;

window.addEventListener('scroll', () => {
  if (!aiFab) return;

  // Collapse immediately on scroll start
  aiFab.classList.add('collapsed');

  // Clear previous timer; restart on every scroll event
  clearTimeout(scrollEndTimer);

  // Expand again ~600 ms after scrolling stops
  scrollEndTimer = setTimeout(() => {
    aiFab.classList.remove('collapsed');
  }, 600);
}, { passive: true });


/* ─────────────────────────────────────────
   5. SERVICE SELECTION — multi-select
   • Toggle add/remove per card
   • Prevent duplicate
   • Show summary bar with chips
   • Remove style-picker entirely
───────────────────────────────────────── */

// State: array of { name, price } objects
let selectedServices = [];

/**
 * Toggle a service card on/off.
 * @param {HTMLElement} card  - The clicked .svc-card element
 * @param {string}      name  - Service name
 * @param {string}      price - Price string e.g. "₹299"
 */
function toggleService(card, name, price) {
  const idx = selectedServices.findIndex(s => s.name === name);

  if (idx === -1) {
    // Add service
    selectedServices.push({ name, price });
    card.classList.add('selected');
    updateSvcButton(card, true);
  } else {
    // Remove service
    selectedServices.splice(idx, 1);
    card.classList.remove('selected');
    updateSvcButton(card, false);
  }

  renderSummaryBar();
  syncConfirmation();
}

/** Update the button text inside a service card. */
function updateSvcButton(card, isSelected) {
  const btn = card.querySelector('.svc-btn');
  if (!btn) return;
  btn.textContent = isSelected ? 'Remove' : 'Add Service';
}

/** Re-render the sticky summary bar above the grid. */
function renderSummaryBar() {
  const bar    = document.getElementById('svc-summary');
  const chips  = document.getElementById('svc-chips');
  if (!bar || !chips) return;

  if (selectedServices.length === 0) {
    bar.style.display = 'none';
    chips.innerHTML   = '';
    return;
  }

  bar.style.display = '';
  chips.innerHTML = selectedServices.map(s => `
    <span class="svc-chip">
      ${s.name}
      <button class="svc-chip-remove" onclick="removeServiceByName('${s.name}')" title="Remove">✕</button>
    </span>
  `).join('');
}

/** Remove a service by name (called from chip × button). */
function removeServiceByName(name) {
  const idx = selectedServices.findIndex(s => s.name === name);
  if (idx === -1) return;

  selectedServices.splice(idx, 1);

  // Deselect matching card
  document.querySelectorAll('.svc-card').forEach(card => {
    const btn = card.querySelector('.svc-btn');
    if (card.querySelector('.svc-name')?.textContent.trim() === name) {
      card.classList.remove('selected');
      if (btn) btn.textContent = 'Add Service';
    }
  });

  renderSummaryBar();
  syncConfirmation();
}

/** Scroll to barbers section (proceed button). */
function proceedToBarbers() {
  const barbersSection = document.getElementById('barbers');
  if (barbersSection) barbersSection.scrollIntoView({ behavior: 'smooth' });
}


/* ─────────────────────────────────────────
   6. BARBER SELECTION
───────────────────────────────────────── */
let currentBarber = '';

/**
 * @param {HTMLElement} card
 * @param {string}      name
 */
function selectBarber(card, name) {
  document.querySelectorAll('.barber-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  currentBarber = name;

  syncConfirmation();

  // Scroll to confirmation after short delay
  setTimeout(() => {
    const conf = document.getElementById('confirmation');
    if (conf) conf.scrollIntoView({ behavior: 'smooth' });
  }, 380);
}


/* ─────────────────────────────────────────
   7. SYNC CONFIRMATION CARD
   Builds service string + total from state
───────────────────────────────────────── */
function syncConfirmation() {
  const svcEl   = document.getElementById('cr-service');
  const barberEl = document.getElementById('cr-barber');
  const totalEl  = document.getElementById('cr-total');

  if (svcEl) {
    svcEl.textContent = selectedServices.length > 0
      ? selectedServices.map(s => s.name).join(' + ')
      : '—';
  }

  if (barberEl) {
    barberEl.textContent = currentBarber || '—';
  }

  if (totalEl) {
    if (selectedServices.length > 0) {
      const sum = selectedServices.reduce((acc, s) => acc + servicePrices[s.name], 0);
      totalEl.textContent = '₹' + sum;
    } else {
      totalEl.textContent = '—';
    }
  }

  // Reset success state if visible
  const success = document.getElementById('conf-success');
  const confMain = document.getElementById('conf-main');
  if (success && confMain) {
    success.classList.remove('show');
    confMain.style.display = '';
  }
}
function clearSelectionsOnly() {

  selectedServices = [];

  document.querySelectorAll('.svc-card').forEach(card => {
    card.classList.remove('selected');

    const btn = card.querySelector('.svc-btn');
    if (btn) btn.textContent = 'Add Service';
  });

  currentBarber = '';

  document.querySelectorAll('.barber-card').forEach(card => {
    card.classList.remove('selected');
  });

  renderSummaryBar();
}


/* ─────────────────────────────────────────
   8. CONFIRM APPOINTMENT
───────────────────────────────────────── */
async function doConfirm() {
  const confMain = document.getElementById('conf-main');
  const success  = document.getElementById('conf-success');
  if (!confMain || !success) return;

  const svc     = (document.getElementById('cr-service')?.textContent || '').trim();
  const dateISO = document.getElementById('cr-date')?.dataset?.iso           || '';
  const time    = (document.getElementById('cr-time')?.textContent  || '').trim();

  if (!svc || svc === '—')    { showToast('Please select at least one service.', 'error'); return; }
  if (!dateISO)                { showToast('Please select a date.', 'error');              return; }
  if (!time || time === '—')  { showToast('Please select a time slot.', 'error');         return; }

  const serviceIds = selectedServices.map(s => APPT_SERVICE_ID_MAP[s.name]).filter(Number.isInteger);
  if (serviceIds.length === 0) {
    showToast('Service lookup failed. Please refresh and try again.', 'error');
    return;
  }

  const barberId = (currentBarber && BARBER_ID_MAP[currentBarber]) ? BARBER_ID_MAP[currentBarber] : null;

  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }

  try {
    const res  = await fetch(API_BASE + '/appointments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({
        services:         serviceIds,
        barber_id:        barberId,
        appointment_date: dateISO,
        appointment_time: time
      })
    });
    const data = await res.json();

    if (res.ok) {
      confMain.style.display = 'none';
      success.classList.add('show');
      loadBookings();
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Booking failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}


/* ─────────────────────────────────────────
   9. BOOKING MODAL
───────────────────────────────────────── */
function openModal() {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.classList.add('show');
  populateModalServices();

  // Pre-select any services already in state (set by AI or previous modal submit)
  const chkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  if (selectedServices.length > 0) {
    const names = new Set(selectedServices.map(s => s.name));
    document.querySelectorAll('#m-services .ea-svc-item').forEach(el => {
      if (names.has(el.dataset.svc)) {
        el.classList.add('selected');
        const check = el.querySelector('.ea-svc-check');
        if (check) check.innerHTML = chkSvg;
      }
    });
  }

  // Pre-fill barber
  const mBarber = document.getElementById('m-barber');
  if (mBarber && currentBarber) mBarber.value = currentBarber;

  // Pre-fill date from the ISO value stored on the confirmation card
  const mDate    = document.getElementById('m-date');
  const crDateEl = document.getElementById('cr-date');
  if (mDate && crDateEl && crDateEl.dataset.iso) mDate.value = crDateEl.dataset.iso;

  // Pre-fill time from the confirmation card
  const mTime    = document.getElementById('m-time');
  const crTimeEl = document.getElementById('cr-time');
  if (mTime && crTimeEl && crTimeEl.textContent.trim() !== '—') mTime.value = crTimeEl.textContent.trim();
}

function closeModal() {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.classList.remove('show');
}

function outsideClose(e) {
  if (e.target === document.getElementById('modal-bg')) closeModal();
}

function populateModalServices() {
  const container = document.getElementById('m-services');
  if (!container) return;
  const chkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  container.innerHTML = APPT_SERVICE_NAMES.map(svc => `
    <div class="ea-svc-item" data-svc="${svc}" onclick="toggleModalSvcItem(this)">
      <div class="ea-svc-check"></div>
      <span class="ea-svc-name">${svc}</span>
      <span class="ea-svc-price">₹${APPT_SERVICE_PRICES[svc] || 0}</span>
    </div>`).join('');
}

function toggleModalSvcItem(el) {
  el.classList.toggle('selected');
  const check = el.querySelector('.ea-svc-check');
  if (!check) return;
  const chkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  check.innerHTML = el.classList.contains('selected') ? chkSvg : '';
}

function submitModal() {
  const selected = [...document.querySelectorAll('#m-services .ea-svc-item.selected')];
  if (selected.length === 0) { showToast('Please select at least one service.', 'error'); return; }

  const svcNames = selected.map(el => el.dataset.svc);
  const barber   = document.getElementById('m-barber')?.value || '';
  const time     = document.getElementById('m-time')?.value   || '';
  const dateVal  = document.getElementById('m-date')?.value   || '';

  // Compute total from live APPT_SERVICE_PRICES (DB-driven after loadServices)
  const totalAmt = svcNames.reduce((sum, n) => sum + (APPT_SERVICE_PRICES[n] || 0), 0);
  const price    = totalAmt > 0 ? '₹' + totalAmt : '—';

  // Sync in-memory state so doConfirm() reads the modal's selection
  selectedServices = svcNames.map(n => ({ name: n, price: '₹' + (APPT_SERVICE_PRICES[n] || 0) }));
  currentBarber    = barber || '';

  // Format date
  let dateStr = '—';
  if (dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Update confirmation card
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cr-service', svcNames.join(' + '));
  set('cr-barber',  barber);
  set('cr-date',    dateStr);
  set('cr-time',    time);
  set('cr-total',   price);
  const crDate = document.getElementById('cr-date');
  if (crDate) crDate.dataset.iso = dateVal;

  // Reset success state
  const confMain = document.getElementById('conf-main');
  const success  = document.getElementById('conf-success');
  if (confMain) confMain.style.display = '';
  if (success)  success.classList.remove('show');

  closeModal();
  const conf = document.getElementById('confirmation');
  if (conf) conf.scrollIntoView({ behavior: 'smooth' });
}


/* ─────────────────────────────────────────
   10. SIDE DRAWER
───────────────────────────────────────── */
const bookings = [];
let _bookingSeq     = 0;
let activeBookingId = null;

const APPT_SERVICE_PRICES = {};
const APPT_SERVICE_NAMES  = [];
const APPT_BARBERS        = [];
const APPT_TIMES          = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM'];
const BARBER_ID_MAP       = {};   // barber_name  → barber_id  (populated by loadBarbers)
const APPT_SERVICE_ID_MAP = {};   // service_name → service_id (populated by loadServices)

const BK_STATUS_LABELS = {
  pending:             'Pending Approval',
  pending_approval:    'Pending Approval',
  confirmed:           'Confirmed',
  reschedule_proposed: 'Reschedule Proposed',
  completed:           'Completed',
  cancelled:           'Cancelled',
  rejected:            'Rejected',
  no_show:             'No Show'
};


function openDrawer(tab) {
  switchDrawerTab(tab || 'profile');
  document.getElementById('drawer')?.classList.add('open');
  document.getElementById('drawer-overlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('drawer-overlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

function switchDrawerTab(tab) {
  document.querySelectorAll('.drawer-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.drawer-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'pane-' + tab);
  });
  if (tab === 'profile')  renderRecentNotifications();
  if (tab === 'bookings') loadBookings();
}

function saveBooking(serviceStr, barber, date, time, total, dateISO) {
  const services = (serviceStr && serviceStr !== '—')
    ? serviceStr.split(' + ').map(s => s.trim()).filter(Boolean)
    : [];
  bookings.unshift({
    id:      ++_bookingSeq,
    services,
    barber:  barber  || '—',
    date:    date    || '—',
    dateISO: dateISO || '',
    time:    time    || '—',
    total:   total   || '—',
    status:  'pending'
  });
  renderBookings();
}

function resolveImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? API_BASE + url : url;
}

function handleBarberImgError(imgEl, initials) {
  const div = document.createElement('div');
  div.className = 'barber-av-placeholder';
  div.textContent = initials;
  imgEl.replaceWith(div);
}

async function loadBarbers() {
  try {
    const res = await fetch(API_BASE + '/barbers');
    if (!res.ok) return;
    const data = await res.json();
    const barberList = data.barbers || [];

    // Rebuild barber ID lookup map
    Object.keys(BARBER_ID_MAP).forEach(k => delete BARBER_ID_MAP[k]);
    barberList.forEach(b => { BARBER_ID_MAP[b.barber_name] = b.barber_id; });

    // Sync APPT_BARBERS — used by the edit-appointment modal barber dropdown
    APPT_BARBERS.length = 0;
    barberList.forEach(b => { APPT_BARBERS.push(b.barber_name); });

    if (barberList.length === 0) return;

    // Populate booking modal barber dropdown
    const mBarber = document.getElementById('m-barber');
    if (mBarber) {
      mBarber.innerHTML = barberList.map(b =>
        `<option value="${b.barber_name}">${b.barber_name}</option>`
      ).join('');
    }

    // Render customer-facing barber cards from live API data
    const grid = document.querySelector('#barbers .barbers-grid');
    if (!grid) return;
    grid.innerHTML = barberList.map(b => {
      const initials   = b.barber_name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
      const availClass = b.is_available ? 'on' : 'busy';
      const availText  = b.is_available ? 'Available' : 'Unavailable';
      const resolvedUrl = resolveImageUrl(b.image_url);
      const photoHtml  = resolvedUrl
        ? `<img src="${resolvedUrl}" alt="${b.barber_name}" onerror="handleBarberImgError(this,'${initials}')" />`
        : `<div class="barber-av-placeholder">${initials}</div>`;
      const spec       = b.specialization || '';
      const safeName   = b.barber_name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<div class="barber-card" onclick="selectBarber(this,'${safeName}')">
        <div class="barber-photo">
          ${photoHtml}
          <div class="avail-pill">
            <div class="avail-dot ${availClass}"></div>${availText}
          </div>
        </div>
        <div class="barber-body">
          <div class="barber-name">${b.barber_name}</div>
          ${spec ? `<div class="barber-spec">${spec}</div>` : ''}
          <button class="barber-btn">Select Barber</button>
        </div>
      </div>`;
    }).join('');
  } catch (_err) {}
}

function fromMysqlTime(timeStr) {
  if (!timeStr) return '—';
  const parts  = timeStr.split(':');
  let h        = parseInt(parts[0], 10);
  const m      = parts[1];
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0)     h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

function normalizeAppointment(a) {
  const rawDate = a.appointment_date;
  let dateISO;
  if (typeof rawDate === 'string') {
    dateISO = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
  } else {
    dateISO = rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : '';
  }
  const d           = new Date(dateISO + 'T00:00:00');
  const dateDisplay = isNaN(d) ? dateISO : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return {
    id:               a.appointment_id,
    services:         (a.services || []).map(s => s.service_name),
    barber:           a.barber_name || '—',
    barberId:         a.barber_id   || null,
    date:             dateDisplay,
    dateISO:          dateISO,
    time:             fromMysqlTime(a.appointment_time),
    total:            '₹' + Math.round(a.total_amount),
    status:           a.status,
    notes:            a.customer_notes    || '',
    proposedDate:     a.proposed_date     || null,
    proposedTime:     a.proposed_time     ? fromMysqlTime(a.proposed_time) : null,
    rescheduleReason: a.reschedule_reason || null
  };
}

// Bumped on every loadBookings() call so an older, slower-to-resolve request
// can detect it's been superseded and discard its (now stale) response instead
// of overwriting the bookings array with out-of-date data.
let bookingsRequestSeq = 0;

async function loadBookings() {
  const token = localStorage.getItem('customerToken');
  if (!token) return;

  const requestId = ++bookingsRequestSeq;

  const empty      = document.getElementById('bk-empty');
  const activeSect = document.getElementById('bk-active-section');
  const bkList     = document.getElementById('bk-list');
  const histSect   = document.getElementById('bk-history-section');

  if (empty)      empty.style.display      = 'none';
  if (activeSect) activeSect.style.display = '';
  if (bkList)     bkList.innerHTML         = '<div style="padding:20px 0;text-align:center;color:var(--text-mid);font-size:0.85rem">Loading bookings…</div>';
  if (histSect)   histSect.style.display   = 'none';

  try {
    const res = await fetch(API_BASE + '/appointments', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
      return;
    }

    // A newer loadBookings() call started after this one — its response will
    // win, so applying this stale response would overwrite fresher data.
    if (requestId !== bookingsRequestSeq) return;

    if (!res.ok) {
      if (bkList) bkList.innerHTML = '<div class="bk-empty" style="padding:16px 0"><div class="bk-empty-title">Couldn\'t load bookings</div><div class="bk-empty-sub">Please try again.</div></div>';
      return;
    }

    const data = await res.json();

    if (requestId !== bookingsRequestSeq) return;

    bookings.length = 0;
    (data.appointments || []).forEach(a => bookings.push(normalizeAppointment(a)));
    renderBookings();

  } catch (_err) {
    if (requestId !== bookingsRequestSeq) return;
    if (bkList) bkList.innerHTML = '<div class="bk-empty" style="padding:16px 0"><div class="bk-empty-title">Connection error</div><div class="bk-empty-sub">Please check your connection and try again.</div></div>';
  }
}

function renderBookings() {
  const empty       = document.getElementById('bk-empty');
  const activeSect  = document.getElementById('bk-active-section');
  const bkList      = document.getElementById('bk-list');
  const noActiveTxt = document.getElementById('bk-no-active');
  const histSect    = document.getElementById('bk-history-section');
  if (!empty) return;

  const active = [
    ...bookings.filter(b => b.status === 'pending' || b.status === 'pending_approval'),
    ...bookings.filter(b => b.status === 'confirmed'),
    ...bookings.filter(b => b.status === 'reschedule_proposed')
  ];
  const history = bookings.filter(b =>
    b.status === 'completed' || b.status === 'cancelled' ||
    b.status === 'rejected'  || b.status === 'no_show'
  );

  if (bookings.length === 0) {
    empty.style.display                              = '';
    if (activeSect)  activeSect.style.display        = 'none';
    if (histSect)    histSect.style.display          = 'none';
    return;
  }

  empty.style.display = 'none';
  if (activeSect) activeSect.style.display = '';

  if (bkList) {
    if (active.length > 0) {
      bkList.style.display = '';
      bkList.innerHTML = active.map(renderBookingCard).join('');
      if (noActiveTxt) noActiveTxt.style.display = 'none';
    } else {
      bkList.style.display = 'none';
      if (noActiveTxt) noActiveTxt.style.display = '';
    }
  }

  if (histSect) {
    if (history.length > 0) {
      histSect.style.display = '';
      renderBookingHistoryPreview(history);
    } else {
      histSect.style.display = 'none';
    }
  }
}

function renderBookingHistoryPreview(history) {
  const preview = document.getElementById('bk-history-preview');
  if (!preview) return;
  preview.innerHTML = history.slice(0, 3).map(b => {
    const statusLabel = BK_STATUS_LABELS[b.status] || b.status;
    const svcDisplay  = b.services.join(' + ');
    return `<div class="bh-card" onclick="openViewDetailsModal(${b.id})">
      <div class="bh-card-left">
        <div class="bh-svc">${svcDisplay}</div>
        <div class="bh-meta">${b.barber} · ${b.date}</div>
      </div>
      <div class="bh-card-right">
        <span class="bk-status ${b.status}">${statusLabel}</span>
        <div class="bh-total">${b.total}</div>
      </div>
    </div>`;
  }).join('');
}

function renderHistoryCard(b) {
  const serviceDisplay = b.services.join(' + ');
  const statusLabel    = BK_STATUS_LABELS[b.status] || b.status;
  return `<div class="bk-card">
    <div class="bk-card-top">
      <div class="bk-service-name">${serviceDisplay}</div>
      <span class="bk-status ${b.status}">${statusLabel}</span>
    </div>
    <div class="bk-meta">
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${b.barber}
      </div>
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${b.date}
      </div>
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${b.time}
      </div>
      <div class="bk-meta-row total">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        ${b.total}
      </div>
    </div>
  </div>`;
}

function renderBookingCard(b) {
  const serviceDisplay = b.services.join(' + ');
  const statusLabel    = BK_STATUS_LABELS[b.status] || b.status;

  const editSvg    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const cancelSvg  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const eyeSvg     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const checkSvg   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  let actions = '';
  if (b.status === 'pending' || b.status === 'pending_approval') {
    actions = `<div class="bk-actions">
      <button class="bk-btn-edit"   onclick="openEditAppointmentModal(${b.id})">${editSvg} Edit</button>
      <button class="bk-btn-cancel" onclick="openCancelModal(${b.id})">${cancelSvg} Cancel</button>
    </div>`;
  } else if (b.status === 'confirmed') {
    actions = `<div class="bk-actions">
      <button class="bk-btn-cancel" style="width:100%;flex:none" onclick="openCancelModal(${b.id})">${cancelSvg} Cancel Appointment</button>
    </div>`;
  } else if (b.status === 'reschedule_proposed') {
    const proposedDateStr = b.proposedDate
      ? new Date(b.proposedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const proposedTimeStr = b.proposedTime || '—';
    actions = `<div class="bk-reschedule-info">
      <div class="bk-reschedule-label">New proposed time</div>
      <div class="bk-reschedule-slot">${proposedDateStr} &middot; ${proposedTimeStr}</div>
    </div>
    <div class="bk-actions">
      <button class="bk-btn-accept" onclick="acceptReschedule(${b.id})">${checkSvg} Accept</button>
      <button class="bk-btn-cancel" onclick="openDeclineRescheduleModal(${b.id})">${cancelSvg} Decline</button>
    </div>`;
  } else {
    actions = `<div class="bk-actions">
      <button class="bk-btn-details" style="width:100%;flex:none" onclick="openViewDetailsModal(${b.id})">${eyeSvg} View Details</button>
    </div>`;
  }

  return `<div class="bk-card" data-id="${b.id}">
    <div class="bk-card-top">
      <div class="bk-service-name">${serviceDisplay}</div>
      <span class="bk-status ${b.status}">${statusLabel}</span>
    </div>
    <div class="bk-meta">
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${b.barber}
      </div>
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${b.date}
      </div>
      <div class="bk-meta-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${b.time}
      </div>
      <div class="bk-meta-row total">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        ${b.total}
      </div>
    </div>
    ${actions}
  </div>`;
}

function handleLogout() {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerId');
  localStorage.removeItem('email');
  window.location.replace('auth/login.html');
}

/* ─────────────────────────────────────────
   11. ACCOUNT MODALS — shared system
───────────────────────────────────────── */
function openAccountModal(id) {
  document.getElementById(id)?.classList.add('show');
}

function closeAccountModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

function outsideCloseAccountModal(e, id) {
  if (e.target.id === id) closeAccountModal(id);
}

function openEditProfileModal() {
  const ni = document.getElementById('ep-name');
  const ei = document.getElementById('ep-email');
  const pi = document.getElementById('ep-phone');
  if (ni) ni.value = currentCustomer.name;
  if (ei) ei.value = currentCustomer.email;
  if (pi) pi.value = currentCustomer.phone;
  const epAvatar = document.querySelector('.ep-avatar-lg');
  if (epAvatar) epAvatar.textContent = currentCustomer.initials;
  openAccountModal('modal-edit-profile');
}
function openChangePasswordModal() { openAccountModal('modal-change-password'); }
function openDeleteAccountModal()  { openAccountModal('modal-delete-account'); }

async function changePassword() {
  const current = document.getElementById('cp-current')?.value || '';
  const newPwd  = document.getElementById('cp-new')?.value     || '';
  const confirm = document.getElementById('cp-confirm')?.value || '';

  if (!current) { showToast('Please enter your current password.', 'error'); return; }
  if (!newPwd)  { showToast('Please enter a new password.', 'error'); return; }
  if (newPwd.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
  if (newPwd !== confirm) { showToast('Passwords do not match.', 'error'); return; }

  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }

  try {
    const res  = await fetch(API_BASE + '/profile/password', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ currentPassword: current, newPassword: newPwd })
    });
    const data = await res.json();

    if (res.ok) {
      ['cp-current', 'cp-new', 'cp-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      closeAccountModal('modal-change-password');
      showToast('Password updated successfully.');
    } else if (res.status === 401 && data.error && data.error.includes('incorrect')) {
      showToast('Current password is incorrect.', 'error');
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Password update failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

/* ─────────────────────────────────────────
   12. NOTIFICATIONS — API + helpers
───────────────────────────────────────── */
function timeAgo(date) {
  if (!date) return '';
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  const days = Math.floor(diff / 86400);
  if (days === 1)   return 'Yesterday';
  if (days < 7)     return days + ' days ago';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadCustomerNotifications() {
  const token = localStorage.getItem('customerToken');
  if (!token) return;
  try {
    const res = await fetch(API_BASE + '/api/customer/notifications', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401) { handleLogout(); return; }
    if (!res.ok) return;
    const data = await res.json();
    customerNotifications = (data.notifications || []).map(n => ({
      id:            n.id,
      type:          n.type,
      title:         n.title,
      message:       n.message,
      appointmentId: n.appointment_id,
      createdAt:     new Date(n.created_at),
      read:          n.is_read === 1 || n.is_read === true
    }));
    renderRecentNotifications();
    const modal = document.getElementById('modal-notifications');
    if (modal && modal.classList.contains('show')) renderNotifications();
  } catch (_err) {}
}

/* ─────────────────────────────────────────
   12b. RECENT NOTIFICATIONS (My Profile pane)
───────────────────────────────────────── */
function renderRecentNotifications() {
  const container = document.getElementById('profile-recent-notifs');
  if (!container) return;
  const recent = customerNotifications.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = '<div style="padding:10px 0;text-align:center;font-size:0.78rem;color:var(--text-mid)">No notifications yet.</div>';
    return;
  }
  container.innerHTML = recent.map(n => `
    <div class="pn-card${n.read ? '' : ' unread'}" onclick="markRead(${n.id})">
      <div class="notif-icon notif-icon--${n.type}">${notifIcons[n.type] || notifIcons.pending || ''}</div>
      <div class="pn-content">
        <div class="pn-title">${n.title}${!n.read ? '<span class="notif-dot"></span>' : ''}</div>
        <div class="pn-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

async function openNotificationsModal() {
  openAccountModal('modal-notifications');
  await Promise.all([loadCustomerNotifications(), loadBookings()]);
  renderNotifications();
}

/* ─────────────────────────────────────────
   13. NOTIFICATIONS
───────────────────────────────────────── */
var customerNotifications = [];

const notifIcons = {
  received:            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  approved:            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  pending:             `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  rescheduled:         `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  completed:           `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  cancelled:           `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  confirmed:           `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  rejected:            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  reschedule_proposed: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  no_show:             `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

function renderNotifications() {
  const list       = document.getElementById('notif-list');
  const markAllBtn = document.getElementById('notif-mark-all-btn');
  if (!list) return;

  const unreadCount = customerNotifications.filter(n => !n.read).length;
  if (markAllBtn) markAllBtn.style.display = unreadCount > 0 ? '' : 'none';

  if (customerNotifications.length === 0) {
    list.innerHTML = '<div style="padding:24px 0;text-align:center;color:var(--text-mid);font-size:0.84rem">No notifications yet.</div>';
    return;
  }

  list.innerHTML = customerNotifications.map(n => {
    const icon     = notifIcons[n.type] || notifIcons.pending || '';
    const resolved = resolvedNotifContent(n);
    const title    = resolved ? resolved.title   : n.title;
    const message  = resolved ? resolved.message : n.message;
    return `
    <div class="notif-card${n.read ? '' : ' unread'}" onclick="handleNotifClick(${n.id},'${n.type}',${n.appointmentId || 'null'})">
      <div class="notif-icon notif-icon--${n.type}">${icon}</div>
      <div class="notif-content">
        <div class="notif-title">${title}${!n.read ? '<span class="notif-dot"></span>' : ''}</div>
        <div class="notif-desc">${message}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>`;
  }).join('');
}

async function markRead(id) {
  const n = customerNotifications.find(n => n.id === id);
  if (!n || n.read) return;
  n.read = true;
  renderNotifications();
  renderRecentNotifications();
  try {
    const token = localStorage.getItem('customerToken');
    if (token) {
      await fetch(API_BASE + '/api/customer/notifications/' + id + '/read', {
        method: 'PUT', headers: { 'Authorization': 'Bearer ' + token }
      });
    }
  } catch (_err) {}
}

async function markAllRead() {
  customerNotifications.forEach(n => { n.read = true; });
  renderNotifications();
  renderRecentNotifications();
  try {
    const token = localStorage.getItem('customerToken');
    if (token) {
      await fetch(API_BASE + '/api/customer/notifications/read-all', {
        method: 'PUT', headers: { 'Authorization': 'Bearer ' + token }
      });
    }
  } catch (_err) {}
}

function resolvedNotifContent(n) {
  if (n.type !== 'reschedule_proposed' || !n.appointmentId) return null;
  const booking = bookings.find(b => b.id === n.appointmentId);
  if (!booking || booking.status === 'reschedule_proposed') return null;
  if (booking.status === 'confirmed') {
    return {
      title:   'Reschedule Accepted',
      message: 'Your appointment was updated to ' + booking.date + ' · ' + booking.time
    };
  }
  if (booking.status === 'cancelled') {
    return {
      title:   'Appointment Cancelled',
      message: 'You declined the proposed time and the appointment was cancelled.'
    };
  }
  return null;
}

function handleNotifClick(id, type, appointmentId) {
  markRead(id);
  if (type === 'reschedule_proposed' && appointmentId) {
    navigateToBooking(appointmentId);
  }
}

async function navigateToBooking(appointmentId) {
  closeAccountModal('modal-notifications');
  openDrawer('bookings');
  await loadBookings();
  const card = document.querySelector('.bk-card[data-id="' + appointmentId + '"]');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.add('bk-highlight');
    setTimeout(() => card.classList.remove('bk-highlight'), 2500);
  }
}

/* ─────────────────────────────────────────
   14. APPOINTMENT MANAGEMENT
───────────────────────────────────────── */
function openEditAppointmentModal(id) {
  const b = bookings.find(b => b.id === id);
  if (!b || (b.status !== 'pending' && b.status !== 'pending_approval')) return;
  activeBookingId = id;

  const chkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const svcContainer = document.getElementById('ea-services');
  if (svcContainer) {
    svcContainer.innerHTML = APPT_SERVICE_NAMES.map(svc => {
      const isSel = b.services.includes(svc);
      return `<div class="ea-svc-item${isSel ? ' selected' : ''}" data-svc="${svc}" onclick="toggleEaSvcItem(this)">
        <div class="ea-svc-check">${isSel ? chkSvg : ''}</div>
        <span class="ea-svc-name">${svc}</span>
        <span class="ea-svc-price">₹${APPT_SERVICE_PRICES[svc] || 0}</span>
      </div>`;
    }).join('');
  }

  const barberSel = document.getElementById('ea-barber');
  if (barberSel) {
    barberSel.innerHTML = APPT_BARBERS.map(bar =>
      `<option value="${bar}"${bar === b.barber ? ' selected' : ''}>${bar}</option>`
    ).join('');
  }

  const dateInput = document.getElementById('ea-date');
  if (dateInput) dateInput.value = b.dateISO || '';

  const timeSel = document.getElementById('ea-time');
  if (timeSel) {
    timeSel.innerHTML = APPT_TIMES.map(t =>
      `<option value="${t}"${t === b.time ? ' selected' : ''}>${t}</option>`
    ).join('');
  }

  openAccountModal('modal-edit-appointment');
}

function toggleEaSvcItem(el) {
  el.classList.toggle('selected');
  const check  = el.querySelector('.ea-svc-check');
  if (!check) return;
  const chkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  check.innerHTML = el.classList.contains('selected') ? chkSvg : '';
}

async function saveEditedAppointment() {
  const svcNames   = [...document.querySelectorAll('#ea-services .ea-svc-item.selected')]
    .map(el => el.dataset.svc);
  const barberName = document.getElementById('ea-barber')?.value || '';
  const dateISO    = document.getElementById('ea-date')?.value   || '';
  const time       = document.getElementById('ea-time')?.value   || '';

  if (svcNames.length === 0) { showToast('Please select at least one service.', 'error'); return; }
  if (!dateISO)               { showToast('Please select a date for the appointment.', 'error'); return; }

  const serviceIds = svcNames.map(n => APPT_SERVICE_ID_MAP[n]).filter(Number.isInteger);
  if (serviceIds.length !== svcNames.length) {
    showToast('Service lookup failed. Please refresh and try again.', 'error'); return;
  }

  const barberId = BARBER_ID_MAP[barberName] || null;
  const token    = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }

  try {
    const res  = await fetch(API_BASE + '/appointments/' + activeBookingId, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ services: serviceIds, barber_id: barberId, appointment_date: dateISO, appointment_time: time })
    });
    const data = await res.json();

    if (res.ok) {
      closeAccountModal('modal-edit-appointment');
      showToast('Appointment updated successfully.');
      await loadBookings();
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Update failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

function openCancelModal(id) {
  const b = bookings.find(b => b.id === id);
  if (!b || (b.status !== 'pending' && b.status !== 'pending_approval' && b.status !== 'confirmed')) return;
  activeBookingId = id;
  openAccountModal('modal-cancel-appointment');
}

async function confirmCancelAppointment() {
  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }

  try {
    const res  = await fetch(API_BASE + '/appointments/' + activeBookingId, {
      method:  'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (res.ok) {
      closeAccountModal('modal-cancel-appointment');
      showToast('Appointment cancelled successfully.');
      activeBookingId = null;
      await loadBookings();
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Cancellation failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

/* ─────────────────────────────────────────
   RESCHEDULE ACCEPT / DECLINE FLOW
───────────────────────────────────────── */
async function acceptReschedule(id) {
  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }
  try {
    const res  = await fetch(API_BASE + '/api/appointments/' + id + '/reschedule/accept', {
      method: 'PUT', headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Reschedule accepted! Appointment confirmed.');
      await loadBookings();
      await loadCustomerNotifications();
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

function openDeclineRescheduleModal(id) {
  activeBookingId = id;
  openAccountModal('modal-decline-reschedule');
}

async function confirmDeclineReschedule() {
  const token = localStorage.getItem('customerToken');
  if (!token) { window.location.replace('auth/login.html'); return; }
  try {
    const res  = await fetch(API_BASE + '/api/appointments/' + activeBookingId + '/reschedule/reject', {
      method: 'PUT', headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (res.ok) {
      closeAccountModal('modal-decline-reschedule');
      showToast('Reschedule declined. Appointment cancelled.');
      activeBookingId = null;
      await loadBookings();
      await loadCustomerNotifications();
    } else if (res.status === 401) {
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerId');
      localStorage.removeItem('email');
      window.location.replace('auth/login.html');
    } else {
      showToast(data.error || 'Failed. Please try again.', 'error');
    }
  } catch (_err) {
    showToast('Connection error. Please try again.', 'error');
  }
}

function openBookingHistoryModal() {
  renderFullHistory();
  openAccountModal('modal-booking-history');
}

function renderFullHistory() {
  const list = document.getElementById('bk-history-list');
  if (!list) return;
  const history = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
  if (history.length === 0) {
    list.innerHTML = `<div class="bk-empty" style="padding:24px 0"><div class="bk-empty-title">No booking history yet</div><div class="bk-empty-sub">Completed and cancelled appointments will appear here.</div></div>`;
    return;
  }
  list.innerHTML = history.map(renderHistoryCard).join('');
}

function openViewDetailsModal(id) {
  const b = bookings.find(b => b.id === id);
  if (!b) return;
  activeBookingId = id;

  const statusLabel    = BK_STATUS_LABELS[b.status] || b.status;
  const serviceDisplay = b.services.join(' + ');
  const content = document.getElementById('vd-content');
  if (content) {
    content.innerHTML = `
      <div class="vd-rows">
        <div class="vd-row"><span class="vd-key">Service(s)</span><span class="vd-val">${serviceDisplay}</span></div>
        <div class="vd-row"><span class="vd-key">Barber</span><span class="vd-val">${b.barber}</span></div>
        <div class="vd-row"><span class="vd-key">Date</span><span class="vd-val">${b.date}</span></div>
        <div class="vd-row"><span class="vd-key">Time</span><span class="vd-val">${b.time}</span></div>
        <div class="vd-row"><span class="vd-key">Total</span><span class="vd-val vd-total">${b.total}</span></div>
        <div class="vd-row vd-row--last"><span class="vd-key">Status</span><span class="bk-status ${b.status}">${statusLabel}</span></div>
      </div>`;
  }

  openAccountModal('modal-view-details');
}

/* Close account modals or drawer on Escape */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const accountModalIds = ['modal-edit-profile', 'modal-change-password', 'modal-delete-account', 'modal-notifications', 'modal-edit-appointment', 'modal-cancel-appointment', 'modal-view-details', 'modal-booking-history', 'modal-decline-reschedule'];
  const openModal = accountModalIds.find(id => document.getElementById(id)?.classList.contains('show'));
  if (openModal) closeAccountModal(openModal);
  else closeDrawer();
});
