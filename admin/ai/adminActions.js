/* ─────────────────────────────────────────
   ADMIN ACTIONS — bridge layer
   Calls ONLY existing admin.js functions via a fixed allowlist.
   Structurally cannot reach save / delete / execute / submit —
   those names never appear in the dispatch tables below.
───────────────────────────────────────── */

var ADMIN_SECTION_LABELS = {
  dashboard: 'Dashboard', appointments: 'Appointments', barbers: 'Barbers',
  services: 'Services', notifications: 'Notifications', settings: 'Settings'
};

/** Navigation bridge — reuses admin.js's switchSection(). */
function adminActionNavigate(target) {
  var sectionId = ADMIN_SECTION_TARGETS[target];
  if (!sectionId || typeof switchSection !== 'function') return null;

  switchSection(sectionId);
  return '✓ Opening ' + (ADMIN_SECTION_LABELS[target] || target) + '...';
}

/** Modal bridge — reuses admin.js's existing open* functions only. */
async function adminActionOpenModal(target, idOrName) {
  var def = ADMIN_MODAL_TARGETS[target];
  if (!def) return null;

  var resolvedId = null;
  if (def.needsId) {
    var isBarber    = (target === 'edit_barber');
    var entityWord  = isBarber ? 'barber' : 'service';
    var entityPage  = isBarber ? 'Barbers' : 'Services';

    // Lazy-load the list if the admin hasn't visited that section yet this session.
    if (isBarber && typeof barbers !== 'undefined' && barbers.length === 0 && typeof loadBarbers === 'function') {
      await loadBarbers();
    }
    if (!isBarber && typeof services !== 'undefined' && services.length === 0 && typeof loadServices === 'function') {
      await loadServices();
    }

    var list = isBarber ? (typeof barbers  !== 'undefined' ? barbers  : [])
                         : (typeof services !== 'undefined' ? services : []);

    if (!idOrName) {
      var names = list.map(function(item) { return item.name || item.barber_name || item.service_name; }).filter(Boolean);
      if (!names.length) {
        return 'No ' + entityWord + 's found. Open ' + entityPage + ' first, then try again.';
      }
      return 'Which ' + entityWord + ' would you like to edit?\n\n' +
             names.map(function(n) { return '• ' + n; }).join('\n');
    }

    resolvedId = adminResolveEntityId(list, idOrName);
    if (!resolvedId) {
      return 'No ' + entityWord + ' named "' + idOrName + '" was found.';
    }
  }

  switch (target) {
    case 'add_service':
      if (typeof openAddService  === 'function') openAddService();
      break;
    case 'edit_service':
      if (typeof openEditService === 'function') openEditService(resolvedId);
      break;
    case 'add_barber':
      if (typeof openAddBarber   === 'function') openAddBarber();
      break;
    case 'edit_barber':
      if (typeof openEditBarber  === 'function') openEditBarber(resolvedId);
      break;
    default:
      return null;
  }

  return '✓ Opening ' + def.label + '...';
}
