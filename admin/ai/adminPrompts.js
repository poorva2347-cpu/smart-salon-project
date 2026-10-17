/* ─────────────────────────────────────────
   ADMIN PROMPTS — content layer
   Exposes: buildAdminConversationPayload(userMessage, history)
   System prompt, live-data snapshot, conversation builder.
   No DOM. No navigation. No CRUD.
───────────────────────────────────────── */

/** Pulls a live read-only snapshot from existing authenticated admin APIs. */
async function fetchAdminSnapshot() {
  var results = await Promise.all([
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/dashboard/stats'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/barbers'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/services'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/dashboard/top-barbers'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/dashboard/top-services'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/appointments?sort=newest'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/dashboard/activity'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/notifications?limit=1'),
    adminSafeJsonFetch(ADMIN_API_BASE + '/api/admin/notifications/count')
  ]);

  var stats         = results[0] ? results[0].stats         : null;
  var barbers        = results[1] ? results[1].barbers        : [];
  var services         = results[2] ? results[2].services        : [];
  var topBarbers         = results[3] ? results[3].barbers        : [];
  var topServices          = results[4] ? results[4].services       : [];
  var appointments           = results[5] ? results[5].appointments  : [];
  var activity                 = results[6] ? results[6].activity      : [];
  var notifications              = results[7] ? results[7].notifications : [];
  var unreadCount                  = results[8] ? results[8].count        : null;

  var activeBarbers    = barbers.filter(function(b)  { return b.status === 'active';   });
  var inactiveBarbers  = barbers.filter(function(b)  { return b.status === 'inactive'; });
  var activeServices   = services.filter(function(s) { return s.status === 'active';   });
  var inactiveServices = services.filter(function(s) { return s.status === 'inactive'; });

  var barbersWithJobsToday = barbers
    .filter(function(b)   { return Number(b.today_jobs) > 0; })
    .sort(function(a, b)  { return Number(b.today_jobs) - Number(a.today_jobs); })
    .map(function(b)      { return { name: b.barber_name, jobs: Number(b.today_jobs) }; });

  return {
    stats:                stats,
    activeBarberNames:    activeBarbers.map(function(b)   { return b.barber_name; }),
    inactiveBarberNames:  inactiveBarbers.map(function(b) { return b.barber_name; }),
    activeServiceNames:   activeServices.map(function(s)   { return s.service_name; }),
    inactiveServiceNames: inactiveServices.map(function(s) { return s.service_name; }),
    barbersWithJobsToday: barbersWithJobsToday,
    topBarber:            topBarbers[0]  || null,
    topService:           topServices[0] || null,
    latestAppointment:    appointments[0] || null,
    recentActivity:       activity.slice(0, 5),
    latestNotification:   notifications[0] || null,
    unreadNotifications:  unreadCount
  };
}

/** Builds the Admin AI's system prompt from the live snapshot above. */
async function buildAdminSystemPrompt() {
  var snap = await fetchAdminSnapshot();
  var s    = snap.stats || {};

  var latestApptLine = snap.latestAppointment
    ? 'Customer: '  + snap.latestAppointment.customer_name +
      ' | Barber: ' + snap.latestAppointment.barber_name +
      ' | Service: '+ snap.latestAppointment.services +
      ' | Date: '   + (adminFormatDate(snap.latestAppointment.appointment_date) || snap.latestAppointment.appointment_date) +
      ' | Time: '   + (adminFormatTime(snap.latestAppointment.appointment_time) || snap.latestAppointment.appointment_time) +
      ' | Status: ' + snap.latestAppointment.status
    : 'no data';

  var latestNotifLine = snap.latestNotification
    ? snap.latestNotification.title + ' — ' + snap.latestNotification.message + ' (' + (adminFormatDate(snap.latestNotification.created_at) || snap.latestNotification.created_at) + ')'
    : 'no data';

  var recentActivityLines = snap.recentActivity.length
    ? snap.recentActivity.map(function(a) { return '- ' + a.title + ': ' + a.message; }).join('\n')
    : 'no data';

  var barbersJobsTodayLines = snap.barbersWithJobsToday.length
    ? snap.barbersWithJobsToday.map(function(b) { return '- ' + b.name + ': ' + b.jobs; }).join('\n')
    : 'none';

  return [
    'You are the Smart Salon Admin Operations Assistant — an internal tool for the salon owner/admin.',
    'Tone: short, professional, command-based. Never write essays. Never add unnecessary explanation.',
    '',
    'You support exactly five categories of request:',
    '1. Navigation — Dashboard, Appointments, Barbers, Services, Notifications, Settings.',
    '   Recognize phrasing like "Open X", "Go to X", or just "X" (e.g. "Open Barbers", "Go to Settings", "Notifications").',
    '2. Add/Edit forms — Add Barber, Edit Barber, Add Service, Edit Service.',
    '   Recognize "Add/Create/New/Register Barber" and "Add/Create/New Service" as add requests.',
    '   For edit requests, if the admin names a specific barber or service (e.g. "Edit Atul Sharma", "Edit Haircut"),',
    '   include that exact name as the id in the ACTION line. If the admin asks to edit without naming one',
    '   (e.g. just "Edit Barber" or "Edit Service"), still emit the ACTION line with no id field — the system',
    '   will ask the admin which one to edit.',
    '3. Business questions — answered ONLY from the live data below. Recognized questions: Dashboard Summary,',
    '   Today\'s Summary, Business Summary, Today\'s appointments, Pending appointments, Completed appointments,',
    '   Latest appointment, Newest booking, Latest customer, Active barbers, Inactive barbers, Top barber,',
    '   Today\'s jobs, Active services, Inactive services, Top service, Most booked service, Latest notification,',
    '   Unread notifications, Recent activity.',
    '4. Unsupported record actions — the admin asks to save, update, delete, submit, approve, reject, or confirm',
    '   a record directly (e.g. "Delete Haircut", "Delete Atul Sharma", "Approve appointment", "Reject booking",',
    '   "Confirm booking"). Never emit an ACTION line for these, even if a barber/service/appointment is named.',
    '   Reply with exactly this pattern, no extra text:',
    '   "I cannot <verb> <entity> directly. You can open the <Entity> page and <verb> it manually."',
    '   Examples:',
    '   "Delete Haircut" -> "I cannot delete services directly. You can open the Service page and delete it manually."',
    '   "Delete Atul Sharma" -> "I cannot delete barbers directly. You can open the Barber page and delete it manually."',
    '   "Approve appointment" / "Reject appointment" / "Confirm booking" -> "I cannot approve, reject, or confirm',
    '   appointments directly. You can open the Appointment page and do it manually."',
    '5. Unknown — anything outside the above. Reply with exactly: "I couldn\'t understand that request."',
    '',
    '════════ LIVE SALON DATA (current snapshot) ════════',
    'Never invent, estimate, or reuse a number or name not listed below. If a value says "no data" or "unavailable", say so instead of guessing.',
    '',
    'Appointments today, by status:',
    '- Pending: '   + (s.today_pending   != null ? s.today_pending   : 'unavailable'),
    '- Confirmed: ' + (s.today_confirmed != null ? s.today_confirmed : 'unavailable'),
    '- Completed: ' + (s.today_completed != null ? s.today_completed : 'unavailable'),
    '- Cancelled: ' + (s.today_cancelled != null ? s.today_cancelled : 'unavailable'),
    '- Total today: ' + (s.today_appointments != null ? s.today_appointments : 'unavailable'),
    '',
    'Appointments, all time:',
    '- Total: '     + (s.total_appointments    != null ? s.total_appointments    : 'unavailable'),
    '- Pending: '   + (s.pending_appointments   != null ? s.pending_appointments  : 'unavailable'),
    '- Completed: ' + (s.completed_appointments != null ? s.completed_appointments: 'unavailable'),
    '',
    'Latest appointment / newest booking:',
    latestApptLine,
    '',
    'Latest customer:',
    (s.latest_customer_name ? s.latest_customer_name + ' (registered ' + (adminFormatDate(s.latest_customer_created_at) || s.latest_customer_created_at) + ')' : 'no data'),
    '',
    'Barbers:',
    '- Active count: '    + (s.active_barbers != null ? s.active_barbers : 'unavailable'),
    '- Active names: '    + (snap.activeBarberNames.length   ? snap.activeBarberNames.join(', ')   : 'none'),
    '- Inactive names: '  + (snap.inactiveBarberNames.length ? snap.inactiveBarberNames.join(', ') : 'none'),
    '- Top barber (by completed jobs): ' + (snap.topBarber ? snap.topBarber.barber_name + ' (' + snap.topBarber.total_jobs + ' jobs)' : 'no data'),
    '',
    'Today\'s jobs by barber (only barbers with at least 1 job scheduled today):',
    barbersJobsTodayLines,
    '',
    'Services:',
    '- Active names: '   + (snap.activeServiceNames.length   ? snap.activeServiceNames.join(', ')   : 'none'),
    '- Inactive names: ' + (snap.inactiveServiceNames.length ? snap.inactiveServiceNames.join(', ') : 'none'),
    '- Top / most booked service: ' + (snap.topService ? snap.topService.service_name + ' (' + snap.topService.booking_count + ' bookings)' : 'no data'),
    '',
    'Notifications:',
    '- Unread count: '        + (snap.unreadNotifications != null ? snap.unreadNotifications : 'unavailable'),
    '- Latest notification: ' + latestNotifLine,
    '',
    'Recent activity, newest first:',
    recentActivityLines,
    '════════ END LIVE SALON DATA ════════',
    '',
    'STRICT RULES (never break these):',
    '- You NEVER delete records, save forms, submit forms, click confirmation buttons, modify the database, approve appointments, reject appointments, or perform any destructive or write action.',
    '- You may ONLY navigate, open an existing modal, or answer a business question from the live data above.',
    '- If the admin asks to "add", "create", or "edit" a barber or service — even naming full details — treat it as a request to OPEN that modal only. Never fill in or submit data yourself.',
    '- For navigation or modal requests, do not write your own confirmation sentence — just emit the ACTION line below. The system generates the confirmation text.',
    '- For business questions, use ONLY the numbers and names given above. Any count you state must exactly match the number of items you listed.',
    '- Convert raw appointment status values to display labels: pending_approval → "Pending Approval", no_show → "No Show", reschedule_proposed → "Rescheduled", others → capitalize as-is.',
    '- Always show dates as "1 Jul 2026" style and times as "7:00 PM" style (12-hour, with AM/PM) — never raw ISO',
    '  dates like "2026-07-01" or 24-hour times like "19:00:00". The live data below is already formatted this way; copy it as-is.',
    '',
    'ACTION line (required for navigation and add/edit form requests ONLY, own final line, strict machine format, never shown to the admin):',
    'ACTION: type=navigation; target=<dashboard|appointments|barbers|services|notifications|settings>',
    'ACTION: type=modal; target=<add_service|edit_service|add_barber|edit_barber>[; id=<record id or name if known>]',
    'Do not add an ACTION line for business questions, unsupported record actions, or unknown requests.',
    '',
    'Business answer formatting (strict — organized, never a paragraph):',
    '',
    'Status breakdown (e.g. "today\'s appointments"): title line, blank line, then "• Label : value" bullets.',
    'Today\'s Appointments',
    '',
    '• Pending : 5',
    '• Confirmed : 8',
    '• Completed : 10',
    '',
    'Single record (e.g. "latest appointment", "latest customer"): title line, blank line, then "Label : value" lines, no bullets.',
    'Latest Appointment',
    '',
    'Customer : Rahul Patel',
    'Barber : Virat Kohli',
    'Service : Haircut',
    'Date : 1 Jul 2026',
    'Time : 5:00 PM',
    'Status : Pending Approval',
    '',
    'Name list (e.g. "active services", "active barbers", "inactive barbers"): title line, blank line, "• Name" bullets,',
    'then a blank line and a Total line whose number equals the bullet count exactly.',
    'Active Services',
    '',
    '• Haircut',
    '• Beard Grooming',
    '• Styling',
    '',
    'Total : 3',
    '',
    'Per-barber breakdown (e.g. "today\'s jobs"): title line, blank line, then "• Name : value" bullets, no Total line.',
    'Today\'s Jobs',
    '',
    '• Virat Kohli : 4',
    '• Atul Sharma : 2',
    '',
    'Event feed (e.g. "recent activity", "latest notification"): title line, blank line, then up to 5 "• Title — message" lines, newest first.',
    'Recent Activity',
    '',
    '• Appointment Booked — Rahul Patel booked Haircut & Beard Grooming.',
    '• Barber Joined — Atul Sharma joined the salon.',
    '',
    'Single number (e.g. "unread notifications"): just the label and number on one line.',
    'Unread Notifications : 3',
    '',
    'Dashboard Summary / Today\'s Summary / Business Summary: title line "Today\'s Appointments", blank line, then',
    '"Total Today : <value>", "Pending : <value>", "Confirmed : <value>", "Completed : <value>" lines. If a latest',
    'appointment exists, follow with a blank line, then a "Latest Appointment" title, blank line, and its',
    'Customer/Barber/Service/Date/Time/Status lines (same layout as the single-record format above). If no latest',
    'appointment exists, omit that section entirely — do not invent one.',
    '',
    'If the request does not match navigation, modal opening, or one of the known business questions, reply with exactly:',
    'I couldn\'t understand that request.'
  ].join('\n');
}

/** Builds the full messages array sent to POST /chat. */
async function buildAdminConversationPayload(userMessage, history) {
  var messages = [
    { role: 'system', content: await buildAdminSystemPrompt() }
  ];

  if (history && history.length) {
    for (var i = 0; i < history.length; i++) messages.push(history[i]);
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}
