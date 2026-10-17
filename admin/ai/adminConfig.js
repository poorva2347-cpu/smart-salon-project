/* ─────────────────────────────────────────
   ADMIN CONFIG — configuration layer
   API URL, constants, feature flags.
   No logic here — values only.
───────────────────────────────────────── */

var ADMIN_API_BASE      = 'http://localhost:3000';
var ADMIN_CHAT_ENDPOINT = ADMIN_API_BASE + '/chat';

var ADMIN_AI_CONFIG = {
  maxHistoryTurns: 10   // user+assistant pairs kept in adminAIChatHistory
};

// Phase 1 foundation flags — crudExecution must stay false permanently.
// The AI is only ever allowed to navigate, open modals, and answer
// business questions from live data.
var ADMIN_AI_FEATURES = {
  navigation:      true,
  modals:          true,
  businessAnswers: true,
  crudExecution:   false
};

// Allowlist: AI intent target -> existing admin.js section id
var ADMIN_SECTION_TARGETS = {
  dashboard:     'dashboard-section',
  appointments:  'appointments-section',
  barbers:       'barbers-section',
  services:      'services-section',
  notifications: 'notifications-section',
  settings:      'settings-section'
};

// Allowlist: AI intent target -> existing admin.js modal opener
var ADMIN_MODAL_TARGETS = {
  add_service:  { label: 'Add Service',  needsId: false },
  edit_service: { label: 'Edit Service', needsId: true  },
  add_barber:   { label: 'Add Barber',   needsId: false },
  edit_barber:  { label: 'Edit Barber',  needsId: true  }
};
