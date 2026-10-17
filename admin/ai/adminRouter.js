/* ─────────────────────────────────────────
   ADMIN ROUTER — routing layer
   Exposes: routeAdminMessage(userText, history)
   Classifies the AI's reply into navigation / modal / business / unknown
   and dispatches to adminActions. Never touches CRUD functions directly.

   Returns { display, historyContent }:
   - display: what the admin sees in the chat bubble (code-generated
     confirmation for actions, or the model's own answer for business/unknown).
   - historyContent: the RAW model output (ACTION line included), which the
     caller must store as this turn's assistant message in adminAIChatHistory.
   The raw text (not the sanitized display text) must go back into history —
   otherwise the next turn's history shows the model an assistant message
   that looks like a plain confirmation with no ACTION line, and the model
   imitates that shape on the next action request, silently omitting its own
   ACTION line (action executes nothing, but chat still shows a confirmation).
───────────────────────────────────────── */

async function routeAdminMessage(userText, history) {
  var messages = await buildAdminConversationPayload(userText, history);
  var raw      = await sendAdminAIRequest(messages);

  if (!raw) {
    var fallback = "I couldn't understand that request.";
    return { display: fallback, historyContent: fallback };
  }

  var action      = parseAdminActionLine(raw);
  var displayText = stripAdminActionLine(raw);

  if (!action) {
    return { display: displayText || "I couldn't understand that request.", historyContent: raw };
  }

  var display;
  switch (action.type) {
    case 'navigation':
      display = adminActionNavigate(action.target) || displayText || "I couldn't understand that request.";
      break;
    case 'modal':
      display = (await adminActionOpenModal(action.target, action.id)) || displayText || "I couldn't understand that request.";
      break;
    case 'business':
      display = displayText || "I couldn't understand that request.";
      break;
    default:
      display = "I couldn't understand that request.";
  }

  return { display: display, historyContent: raw };
}
