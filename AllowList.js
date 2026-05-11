/**
 * Email allowlist: same spreadsheet as master; sheet name configurable.
 * Column A = one email per row. Header cell may contain "email".
 */

/**
 * @param {string} sheetName
 * @returns {string[]}
 */
function readAllowListEmails_(sheetName) {
  var ss = openMasterSpreadsheet_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    throw new Error('AllowList sheet not found: ' + sheetName);
  }
  var last = sh.getLastRow();
  if (last < 1) return [];

  var col = sh
    .getRange(1, ALLOWLIST_EMAIL_COL, last, ALLOWLIST_EMAIL_COL)
    .getValues();
  var out = [];
  for (var i = 0; i < col.length; i++) {
    var raw = col[i][0];
    if (raw === '' || raw === null || raw === undefined) continue;
    var s = String(raw).trim().toLowerCase();
    if (!s || s === 'email') continue;
    out.push(s);
  }
  return out;
}

/**
 * @returns {boolean}
 */
function isEmailAllowed_() {
  var cfg = getTasksConfig_();
  if (cfg.skipAllowlist) return true;

  var email =
    Session.getActiveUser().getEmail() ||
    Session.getEffectiveUser().getEmail();
  if (!email) return false;

  var list = readAllowListEmails_(cfg.allowListSheetName);
  var normalized = email.trim().toLowerCase();
  return list.indexOf(normalized) !== -1;
}

/**
 * @returns {{ ok: boolean, email: string, message?: string }}
 */
function checkAllowlistOr403_() {
  var cfg = getTasksConfig_();
  if (cfg.skipAllowlist) {
    return {
      ok: true,
      email:
        Session.getActiveUser().getEmail() ||
        Session.getEffectiveUser().getEmail() ||
        '',
    };
  }

  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return {
      ok: false,
      email: '',
      message: 'Active user email is empty. Open the web app while signed in.',
    };
  }

  var allowed = false;
  try {
    allowed = isEmailAllowed_();
  } catch (err) {
    return { ok: false, email: email, message: String(err) };
  }

  if (!allowed) {
    return {
      ok: false,
      email: email,
      message: 'Email is not on the allow list.',
    };
  }
  return { ok: true, email: email };
}
